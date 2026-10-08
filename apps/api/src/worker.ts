import 'reflect-metadata';
import './telemetry';
import { Worker, Job } from 'bullmq';
import { Emitter } from '@socket.io/redis-emitter';
import { and, eq, isNull, lte, cosineDistance } from 'drizzle-orm';
import { PDFParse } from 'pdf-parse';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { context, propagation, trace } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import { z } from '@trackr/shared';
import { env } from './config';
import { DbService } from './db/db.service';
import {
  aiResults,
  applications,
  jobs,
  notifications,
  reminders,
  resumes,
  users,
} from './db/schema';
import { QueueService } from './modules/queue/queue.module';
import { StorageService } from './modules/storage/storage.module';
import { emailTemplate } from './modules/emails/templates';
const database = new DbService();
const db = database.db;
const queues = new QueueService();
const storage = new StorageService();
const emitter = new Emitter(queues.redis);
const aiBody = z.object({ userId: z.uuid(), resultId: z.uuid() });
const parseBody = z.object({ userId: z.uuid(), resumeId: z.uuid() });
const jobBody = z.object({ userId: z.uuid(), jobId: z.uuid() });
const vectorSchema = z.object({
  vectors: z.array(z.array(z.number().finite()).length(env.EMBEDDING_DIM)),
});
async function ai(path: string, body: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Key': env.AI_INTERNAL_KEY,
  };
  propagation.inject(context.active(), headers);
  const res = await fetch(`${env.AI_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok)
    throw new Error(
      `AI service returned ${res.status}. Check provider configuration and service logs.`,
    );
  return res;
}
async function embed(text: string) {
  const data = vectorSchema.parse(await (await ai('/embed', { texts: [text] })).json());
  if (!data.vectors[0]) throw new Error('Missing embedding');
  return data.vectors[0];
}
async function notify(userId: string, eventKey: string, title: string, body: string) {
  const [row] = await db
    .insert(notifications)
    .values({ userId, eventKey, type: 'SYSTEM', title, body })
    .onConflictDoNothing()
    .returning();
  if (row) emitter.to(`user:${userId}`).emit('notification', row);
}
async function parse(job: Job) {
  if (job.name === 'embed-job') {
    const { userId, jobId } = jobBody.parse(job.data);
    const row = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    });
    if (!row || row.embedding) return;
    const embedding = await embed(`${row.title}\n${row.description}`);
    await db
      .update(jobs)
      .set({ embedding })
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId), eq(jobs.updatedAt, row.updatedAt)));
    return;
  }
  const { userId, resumeId } = parseBody.parse(job.data);
  const row = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
  if (!row || row.status === 'READY') return;
  await db
    .update(resumes)
    .set({ status: 'PARSING' })
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)));
  const parser = new PDFParse({ data: await storage.bytes(row.fileKey) });
  let text: string;
  try {
    text = (await parser.getText()).text.slice(0, 50000);
  } finally {
    await parser.destroy();
  }
  if (text.trim().length < 20)
    throw new Error('This PDF has no readable text. Upload a text-based PDF.');
  const parsed = z
    .object({
      skills: z.array(z.string()),
      experience: z.array(z.string()),
      education: z.array(z.string()),
    })
    .parse(await (await ai('/parse-resume', { text })).json());
  const embedding = await embed(text);
  await db
    .update(resumes)
    .set({ status: 'READY', parsedText: text, parsedJson: parsed, embedding })
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)));
  await notify(
    userId,
    `resume-${resumeId}`,
    'Your CV is ready',
    `${row.fileName} has been parsed. You can now analyze your job matches.`,
  );
}
async function generate(job: Job) {
  const { userId, resultId } = aiBody.parse(job.data);
  const result = await db.query.aiResults.findFirst({ where: eq(aiResults.id, resultId) });
  if (!result || result.status !== 'PENDING') return;
  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, result.applicationId), eq(applications.userId, userId)),
  });
  if (!application?.resumeId) throw new Error('Application or CV was removed');
  const [resume, posting] = await Promise.all([
    db.query.resumes.findFirst({
      where: and(eq(resumes.id, application.resumeId), eq(resumes.userId, userId)),
    }),
    db.query.jobs.findFirst({
      where: and(eq(jobs.id, application.jobId), eq(jobs.userId, userId)),
    }),
  ]);
  if (!resume?.parsedText || !posting) throw new Error('CV is not ready');
  const input = {
    resume: resume.parsedText,
    job: `${posting.title} at ${posting.company}\n${posting.description}`,
    tone: result.content?.tone || 'formal',
  };
  let content: Record<string, unknown>;
  let score: number | null = null;
  if (result.type === 'MATCH') {
    const embedding = posting.embedding ?? (await embed(input.job));
    const [distance] = await db
      .select({ distance: cosineDistance(resumes.embedding, embedding) })
      .from(resumes)
      .where(and(eq(resumes.id, resume.id), eq(resumes.userId, userId)));
    content = z
      .object({
        score: z.number().int().min(0).max(100),
        strengths: z.array(z.string()),
        gaps: z.array(z.string()),
      })
      .parse(
        await (
          await ai('/match', {
            ...input,
            similarity: distance?.distance == null ? null : 1 - Number(distance.distance),
          })
        ).json(),
      );
    score = Number(content.score);
  } else if (result.type === 'INTERVIEW_QUESTIONS') {
    content = z
      .object({
        questions: z.array(
          z.object({ question: z.string(), category: z.string(), tip: z.string() }),
        ),
      })
      .parse(await (await ai('/interview-questions', input)).json());
  } else {
    const response = await ai('/cover-letter/stream', input);
    if (!response.body) throw new Error('No stream returned');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      await queues.redis.set(`stream:${result.id}`, text, 'EX', 600);
    }
    text += decoder.decode();
    if (!text.trim()) throw new Error('Provider returned an empty cover letter');
    content = { text };
  }
  await db
    .update(aiResults)
    .set({ status: 'DONE', score, content })
    .where(eq(aiResults.id, resultId));
  await notify(
    userId,
    `ai-${resultId}`,
    'Your AI result is ready',
    `${result.type.toLowerCase().replaceAll('_', ' ')} for ${posting.company} is ready to review.`,
  );
}
async function sendEmail(userId: string, title: string, message: string, key: string) {
  if (await queues.redis.get(`mail-sent:${key}`)) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  const html = await emailTemplate(user.name, title, message);
  if (env.EMAIL_PROVIDER === 'resend') {
    const result = await new Resend(env.RESEND_API_KEY).emails.send(
      { from: env.EMAIL_FROM, to: user.email, subject: title, html },
      { idempotencyKey: key },
    );
    if (result.error) throw new Error(result.error.message);
  } else
    await nodemailer
      .createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false })
      .sendMail({
        from: env.EMAIL_FROM,
        to: user.email,
        subject: title,
        html,
        messageId: `<${key}@trackr.local>`,
      });
  await queues.redis.set(`mail-sent:${key}`, '1', 'EX', 30 * 86400);
}
async function email(job: Job) {
  const { userId } = z.object({ userId: z.uuid() }).parse(job.data);
  if (job.name === 'welcome')
    return sendEmail(
      userId,
      'Welcome to Trackr',
      'Your next chapter starts here. Save a job, add your CV, and keep your search moving forward.',
      `welcome-${userId}`,
    );
  if (job.name === 'weekly') {
    const rows = await db.query.applications.findMany({ where: eq(applications.userId, userId) });
    return sendEmail(
      userId,
      'Your weekly job search check-in',
      `You are tracking ${rows.length} opportunities, including ${rows.filter((a) => a.status === 'INTERVIEW').length} interviews. Take a moment to plan your next move.`,
      job.id!,
    );
  }
  const { reminderId } = z.object({ reminderId: z.uuid() }).parse(job.data);
  const reminder = await db.query.reminders.findFirst({
    where: and(eq(reminders.id, reminderId), eq(reminders.userId, userId)),
  });
  if (!reminder || reminder.sentAt) return;
  await sendEmail(userId, 'Time for a follow-up', reminder.message, `reminder-${reminderId}`);
  await db
    .update(reminders)
    .set({ sentAt: new Date() })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)));
  await notify(userId, `reminder-${reminderId}`, 'Follow-up reminder', reminder.message);
}
async function sweep(job: Job) {
  if (job.name === 'weekly') {
    for (const user of await db.select({ id: users.id }).from(users))
      await queues.add(
        'emails',
        'weekly',
        { userId: user.id },
        `weekly-${user.id}-${new Date().toISOString().slice(0, 10)}`,
      );
    return;
  }
  for (const r of await db.query.reminders.findMany({
    where: and(isNull(reminders.sentAt), lte(reminders.remindAt, new Date())),
  }))
    await queues.add(
      'emails',
      'reminder',
      { userId: r.userId, reminderId: r.id },
      `reminder-${r.id}`,
    );
  for (const r of await db
    .select({ id: aiResults.id, userId: applications.userId })
    .from(aiResults)
    .innerJoin(applications, eq(aiResults.applicationId, applications.id))
    .where(eq(aiResults.status, 'PENDING')))
    await queues.add('ai-tasks', 'generate', { userId: r.userId, resultId: r.id }, `ai-${r.id}`);
  for (const r of await db.query.resumes.findMany({ where: eq(resumes.status, 'UPLOADED') }))
    await queues.add(
      'resume-parse',
      'parse',
      { userId: r.userId, resumeId: r.id },
      `resume-${r.id}`,
    );
}
function traced(handler: (job: Job) => Promise<unknown>) {
  return (job: Job) => {
    const carrier =
      z.object({ trace: z.record(z.string(), z.string()).optional() }).parse(job.data).trace ?? {};
    return context.with(propagation.extract(context.active(), carrier), () =>
      trace.getTracer('trackr-worker').startActiveSpan(job.name, async (span) => {
        try {
          return await handler(job);
        } catch (e) {
          span.recordException(e instanceof Error ? e : new Error(String(e)));
          throw e;
        } finally {
          span.end();
        }
      }),
    );
  };
}
const workers = [
  new Worker('resume-parse', traced(parse), { connection: queues.redis, concurrency: 2 }),
  new Worker('ai-tasks', traced(generate), { connection: queues.redis, concurrency: 3 }),
  new Worker('emails', traced(email), { connection: queues.redis, concurrency: 2 }),
  new Worker('reminders', traced(sweep), { connection: queues.redis, concurrency: 1 }),
];
for (const worker of workers)
  worker.on('failed', (job, error) => {
    console.error(JSON.stringify({ level: 'error', jobId: job?.id, message: error.message }));
    Sentry.captureException(error);
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3))
      void (async () => {
        if (worker.name === 'ai-tasks') {
          const input = aiBody.parse(job.data);
          await db
            .update(aiResults)
            .set({
              status: 'FAILED',
              content: {
                error: 'Generation failed. Check the AI service configuration and try again.',
              },
            })
            .where(eq(aiResults.id, input.resultId));
          await notify(
            input.userId,
            `ai-failed-${input.resultId}`,
            'AI task failed',
            'Please check the provider configuration and try again.',
          );
        }
        if (worker.name === 'resume-parse' && job.name === 'parse') {
          const input = parseBody.parse(job.data);
          await db
            .update(resumes)
            .set({ status: 'FAILED' })
            .where(and(eq(resumes.id, input.resumeId), eq(resumes.userId, input.userId)));
          await notify(
            input.userId,
            `parse-failed-${input.resumeId}`,
            'CV parsing failed',
            'Try a text-based PDF and check your AI provider configuration.',
          );
        }
      })().catch(console.error);
  });
async function start() {
  await queues.queues.reminders.upsertJobScheduler(
    'due-reminders',
    { every: 300000 },
    { name: 'sweep', data: {} },
  );
  await queues.queues.reminders.upsertJobScheduler(
    'weekly-summary',
    { pattern: '0 8 * * 1', tz: 'UTC' },
    { name: 'weekly', data: {} },
  );
  console.log(JSON.stringify({ level: 'info', message: 'Trackr worker ready' }));
}
async function stop() {
  await Promise.all(workers.map((w) => w.close()));
  await queues.onModuleDestroy();
  await database.onModuleDestroy();
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
void start();
