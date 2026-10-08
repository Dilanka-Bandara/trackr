import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { DbModule } from './db/db.service';
import { QueueModule } from './modules/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard, RolesGuard, SecurityGuard } from './modules/auth/guards';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { StorageModule } from './modules/storage/storage.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { StatsModule } from './modules/stats/stats.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: () => randomUUID(),
        redact: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-internal-key"]',
          'res.headers["set-cookie"]',
        ],
        customProps: (req) => ({
          userId: 'user' in req ? (req.user as { id?: string })?.id : undefined,
        }),
      },
    }),
    DbModule,
    QueueModule,
    AuthModule,
    JobsModule,
    ApplicationsModule,
    StorageModule,
    ResumesModule,
    AiModule,
    NotificationsModule,
    RemindersModule,
    StatsModule,
    BillingModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SecurityGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
