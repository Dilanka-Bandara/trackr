import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, count } from 'drizzle-orm';
import { JobInput } from '@trackr/shared';
import { DbService } from '../../db/db.service';
import { jobs } from '../../db/schema';
import { QueueService } from '../queue/queue.module';
@Injectable()
export class JobsService {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  async list(userId: string, page = 1, search = '', sort = 'newest') {
    const where = and(
      eq(jobs.userId, userId),
      search ? or(ilike(jobs.company, `%${search}%`), ilike(jobs.title, `%${search}%`)) : undefined,
    );
    const [items, totals] = await Promise.all([
      this.database.db
        .select()
        .from(jobs)
        .where(where)
        .orderBy(sort === 'company' ? asc(jobs.company) : desc(jobs.createdAt))
        .limit(20)
        .offset((page - 1) * 20),
      this.database.db.select({ total: count() }).from(jobs).where(where),
    ]);
    return {
      items: items.map(({ embedding: _embedding, ...j }) => j),
      total: totals[0]?.total ?? 0,
      page,
      pageSize: 20,
    };
  }
  async get(userId: string, id: string) {
    const job = await this.database.db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
      columns: { embedding: false },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
  async create(userId: string, input: JobInput) {
    const [job] = await this.database.db
      .insert(jobs)
      .values({ ...input, userId })
      .returning();
    if (!job) throw new Error('Insert failed');
    await this.queue.add(
      'resume-parse',
      'embed-job',
      { userId, jobId: job.id },
      `job-${job.id}-${job.updatedAt.getTime()}`,
    );
    return job;
  }
  async update(userId: string, id: string, input: JobInput) {
    const [job] = await this.database.db
      .update(jobs)
      .set({ ...input, embedding: null })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    if (!job) throw new NotFoundException('Job not found');
    await this.queue.add(
      'resume-parse',
      'embed-job',
      { userId, jobId: job.id },
      `job-${job.id}-${job.updatedAt.getTime()}`,
    );
    return job;
  }
  async delete(userId: string, id: string) {
    const result = await this.database.db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    if (!result.length) throw new NotFoundException('Job not found');
    return { ok: true };
  }
}
