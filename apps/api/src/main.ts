import 'reflect-metadata';
import './telemetry';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/http';
import { env } from './config';
import { DbService } from './db/db.service';
import { users } from './db/schema';
import { QueueService } from './modules/queue/queue.module';
async function main() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY_HOPS);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  const board = new ExpressAdapter();
  board.setBasePath('/api/admin/queues');
  createBullBoard({
    queues: Object.values(app.get(QueueService).queues).map(
      (q) => new BullMQAdapter(q, { readOnlyMode: true }),
    ),
    serverAdapter: board,
  });
  app.use(
    '/api/admin/queues',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payload = app
          .get(JwtService)
          .verify<{ sub: string }>(req.cookies?.access_token || '');
        const user = await app
          .get(DbService)
          .db.query.users.findFirst({ where: eq(users.id, payload.sub) });
        if (user?.role !== 'ADMIN') {
          res
            .status(403)
            .json({ statusCode: 403, message: 'Admin access required', error: 'Forbidden' });
          return;
        }
        next();
      } catch {
        res.status(401).json({ statusCode: 401, message: 'Please sign in', error: 'Unauthorized' });
      }
    },
    board.getRouter(),
  );
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Trackr API')
        .setDescription(
          'Cookie authentication. For Swagger mutations, obtain /api/auth/csrf, then enter its token in Authorize under csrf. Use the configured API or web origin.',
        )
        .setVersion('1.0')
        .addCookieAuth('access_token')
        .addApiKey({ type: 'apiKey', in: 'header', name: 'X-CSRF-Token' }, 'csrf')
        .addSecurityRequirements('csrf')
        .build(),
    ),
  );
  await app.listen(env.PORT, '0.0.0.0');
}
void main();
