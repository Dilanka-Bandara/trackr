import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Injectable,
  MessageEvent,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { and, desc, eq } from 'drizzle-orm';
import { aiTaskSchema, planLimits, User, z } from '@trackr/shared';
import { CurrentUser, Endpoint, ZodPipe } from '../../common/http';
import { DbService } from '../../db/db.service';
import { aiResults, resumes, usage, users } from '../../db/schema';
import { ApplicationsModule } from '../applications/applications.module';
import { ApplicationsService } from '../applications/applications.service';
import { QueueService } from '../queue/queue.module';
@Injectable()
export class AiService {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(ApplicationsService) private readonly applications: ApplicationsService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  async enqueue(user: User, id: string, input: z.infer<typeof aiTaskSchema>) {
    const application = await this.applications.get(user.id, id);
    if (!application.resumeId) throw new BadRequestException('Choose a parsed CV before using AI');
    const resume = await this.database.db.query.resumes.findFirst({
      where: and(eq(resumes.id, application.resumeId), eq(resumes.userId, user.id)),
    });
    if (resume?.status !== 'READY')
      throw new BadRequestException('Your CV must finish parsing first');
    const month = new Date().toISOString().slice(0, 7);
    const result = await this.database.db.transaction(async (tx) => {
      // Serialize usage reservation with the user's plan, preventing concurrent quota overspend.
      const [account] = await tx.select().from(users).where(eq(users.id, user.id)).for('update');
      const current = await tx.query.usage.findFirst({
        where: and(eq(usage.userId, user.id), eq(usage.month, month)),
      });
      if ((current?.aiCalls ?? 0) >= planLimits[account!.plan])
        throw new HttpException(
          'Monthly AI limit reached. Upgrade your plan or wait until next month.',
          402,
        );
      await tx
        .insert(usage)
        .values({ userId: user.id, month, aiCalls: 1 })
        .onConflictDoUpdate({
          target: [usage.userId, usage.month],
          set: { aiCalls: (current?.aiCalls ?? 0) + 1 },
        });
      const [row] = await tx
        .insert(aiResults)
        .values({ applicationId: id, type: input.type, content: { tone: input.tone, month } })
        .returning();
      return row!;
    });
    // PENDING rows are a durable outbox: the worker sweeper recovers a Redis interruption.
    await this.queue
      .add('ai-tasks', 'generate', { userId: user.id, resultId: result.id }, `ai-${result.id}`)
      .catch(() => undefined);
    return result;
  }
  async list(userId: string, id: string) {
    await this.applications.get(userId, id);
    return this.database.db.query.aiResults.findMany({
      where: eq(aiResults.applicationId, id),
      orderBy: desc(aiResults.createdAt),
      limit: 30,
    });
  }
  async stream(userId: string, id: string): Promise<Observable<MessageEvent>> {
    await this.applications.get(userId, id);
    return new Observable((subscriber) => {
      let busy = false;
      let previous = '';
      const started = Date.now();
      const tick = async () => {
        if (busy) return;
        busy = true;
        try {
          const row = await this.database.db.query.aiResults.findFirst({
            where: and(eq(aiResults.applicationId, id), eq(aiResults.type, 'COVER_LETTER')),
            orderBy: desc(aiResults.createdAt),
          });
          if (!row) {
            subscriber.next({ type: 'failed', data: { message: 'Start a cover letter first' } });
            subscriber.complete();
            return;
          }
          const content =
            (await this.queue.redis.get(`stream:${row.id}`)) ||
            (typeof row.content?.text === 'string' ? row.content.text : '');
          if (content !== previous) {
            previous = content;
            subscriber.next({ type: 'text', data: { text: content } });
          }
          if (row.status !== 'PENDING') {
            subscriber.next({ type: row.status === 'DONE' ? 'done' : 'failed', data: row });
            subscriber.complete();
          } else if (Date.now() - started > 180000) {
            subscriber.next({
              type: 'failed',
              data: { message: 'Stream timed out. You can reopen the saved result later.' },
            });
            subscriber.complete();
          }
        } catch (error) {
          subscriber.error(error);
        } finally {
          busy = false;
        }
      };
      const timer = setInterval(() => void tick(), 500);
      void tick();
      return () => clearInterval(timer);
    });
  }
}
@ApiTags('AI')
@Controller('applications/:id/ai')
export class AiController {
  constructor(@Inject(AiService) private readonly service: AiService) {}
  @Post() @Endpoint('Queue a match, cover letter, or interview preparation', aiTaskSchema) generate(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(aiTaskSchema)) input: z.infer<typeof aiTaskSchema>,
  ) {
    return this.service.enqueue(u, id, input);
  }
  @Get() @Endpoint('Get saved AI results') list(
    @CurrentUser() u: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.list(u.id, id);
  }
  @Sse('cover-letter/stream')
  @Endpoint('Subscribe to the queued cover letter; no generation on GET')
  stream(@CurrentUser() u: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.stream(u.id, id);
  }
}
@Module({ imports: [ApplicationsModule], controllers: [AiController], providers: [AiService] })
export class AiModule {}
