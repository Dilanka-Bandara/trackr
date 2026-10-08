import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { context, propagation } from '@opentelemetry/api';
import { env } from '../../config';
export const queueNames = ['resume-parse', 'ai-tasks', 'emails', 'reminders'] as const;
@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  readonly queues = Object.fromEntries(
    queueNames.map((name) => [
      name,
      new Queue(name, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      }),
    ]),
  ) as Record<(typeof queueNames)[number], Queue>;
  async add(
    queue: (typeof queueNames)[number],
    name: string,
    data: Record<string, unknown>,
    id: string,
  ) {
    const trace: Record<string, string> = {};
    propagation.inject(context.active(), trace);
    return this.queues[queue].add(name, { ...data, trace }, { jobId: id });
  }
  async onModuleDestroy() {
    await Promise.all(Object.values(this.queues).map((q) => q.close()));
    await this.redis.quit();
  }
}
@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
