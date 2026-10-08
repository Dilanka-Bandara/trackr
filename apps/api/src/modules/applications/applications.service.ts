import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { applicationSchema, moveSchema, notesSchema, z } from '@trackr/shared';
import { DbService } from '../../db/db.service';
import { aiResults, applications, jobs, resumes, users } from '../../db/schema';
@Injectable()
export class ApplicationsService {
  constructor(@Inject(DbService) private readonly database: DbService) {}
  async list(userId: string) {
    const rows = await this.database.db
      .select({
        application: applications,
        job: {
          id: jobs.id,
          company: jobs.company,
          title: jobs.title,
          location: jobs.location,
          salaryText: jobs.salaryText,
          url: jobs.url,
          description: jobs.description,
          createdAt: jobs.createdAt,
        },
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.userId, userId))
      .orderBy(asc(applications.position), desc(applications.createdAt));
    const scores = await this.database.db
      .select({ applicationId: aiResults.applicationId, score: aiResults.score })
      .from(aiResults)
      .innerJoin(applications, eq(aiResults.applicationId, applications.id))
      .where(
        and(
          eq(applications.userId, userId),
          eq(aiResults.type, 'MATCH'),
          eq(aiResults.status, 'DONE'),
        ),
      )
      .orderBy(desc(aiResults.createdAt));
    return rows.map((r) => ({
      ...r.application,
      job: r.job,
      score: scores.find((s) => s.applicationId === r.application.id)?.score ?? null,
    }));
  }
  async get(userId: string, id: string) {
    const application = await this.database.db.query.applications.findFirst({
      where: and(eq(applications.id, id), eq(applications.userId, userId)),
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }
  async verifyResume(userId: string, id?: string | null) {
    if (
      id &&
      !(await this.database.db.query.resumes.findFirst({
        where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
      }))
    )
      throw new NotFoundException('CV not found');
  }
  async create(userId: string, body: z.infer<typeof applicationSchema>) {
    await this.verifyResume(userId, body.resumeId);
    if (
      !(await this.database.db.query.jobs.findFirst({
        where: and(eq(jobs.id, body.jobId), eq(jobs.userId, userId)),
      }))
    )
      throw new NotFoundException('Job not found');
    const [result] = await this.database.db
      .insert(applications)
      .values({ ...body, userId, appliedAt: body.status !== 'WISHLIST' ? new Date() : null })
      .onConflictDoNothing()
      .returning();
    if (!result) throw new ConflictException('This job already has an application');
    return result;
  }
  async update(userId: string, id: string, input: z.infer<typeof notesSchema>) {
    await this.verifyResume(userId, input.resumeId);
    const [result] = await this.database.db
      .update(applications)
      .set(input)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .returning();
    if (!result) throw new NotFoundException('Application not found');
    return result;
  }
  async move(userId: string, id: string, move: z.infer<typeof moveSchema>) {
    return this.database.db.transaction(async (tx) => {
      // Lock one parent row to serialize all board edits for this user, including empty columns.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const all = await tx
        .select()
        .from(applications)
        .where(eq(applications.userId, userId))
        .orderBy(asc(applications.position), asc(applications.id));
      const current = all.find((a) => a.id === id);
      if (!current) throw new NotFoundException('Application not found');
      const target = all.filter((a) => a.id !== id && a.status === move.status);
      target.splice(Math.min(move.position, target.length), 0, { ...current, status: move.status });
      const source =
        current.status === move.status
          ? []
          : all.filter((a) => a.id !== id && a.status === current.status);
      for (const column of [source, target])
        for (const [position, row] of column.entries())
          await tx
            .update(applications)
            .set({
              status: row.status,
              position,
              appliedAt:
                row.id === id && move.status !== 'WISHLIST' && !row.appliedAt
                  ? new Date()
                  : row.appliedAt,
            })
            .where(and(eq(applications.id, row.id), eq(applications.userId, userId)));
      return { ok: true };
    });
  }
  async delete(userId: string, id: string) {
    await this.get(userId, id);
    await this.database.db
      .delete(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)));
    return { ok: true };
  }
}
