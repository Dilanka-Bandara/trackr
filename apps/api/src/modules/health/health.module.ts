import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Endpoint, Public } from '../../common/http';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { QueueService } from '../queue/queue.module';
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DbService) private readonly database: DbService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}
  @Public() @Get() @Endpoint('Check PostgreSQL and Redis readiness') async health() {
    try {
      await Promise.all([
        this.database.db.select({ id: users.id }).from(users).limit(1),
        this.queue.redis.ping(),
      ]);
      return { status: 'ok', postgres: 'ok', redis: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database or queue is unavailable');
    }
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
