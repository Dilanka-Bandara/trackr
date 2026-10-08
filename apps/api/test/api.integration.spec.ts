import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { DbModule, DbService } from '../src/db/db.service';
import * as schema from '../src/db/schema';
import { AuthModule } from '../src/modules/auth/auth.module';
import { JwtAuthGuard, RolesGuard, SecurityGuard } from '../src/modules/auth/guards';
import { JobsModule } from '../src/modules/jobs/jobs.module';
import { ApplicationsModule } from '../src/modules/applications/applications.module';
import { StatsModule } from '../src/modules/stats/stats.module';
import { ResumesModule } from '../src/modules/resumes/resumes.module';
import { StorageModule, StorageService } from '../src/modules/storage/storage.module';
import { QueueModule, QueueService } from '../src/modules/queue/queue.module';
import { RemindersModule } from '../src/modules/reminders/reminders.module';
import { AiModule } from '../src/modules/ai/ai.module';
import { BillingModule } from '../src/modules/billing/billing.module';
import { AdminModule } from '../src/modules/admin/admin.module';
import { ErrorFilter } from '../src/common/http';
import { BillingService } from '../src/modules/billing/billing.module';
import Stripe from 'stripe';
import { env } from '../src/config';

describe('API with a real PostgreSQL engine (PGlite locally, PostgreSQL in CI)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let db: DbService['db'];
  let alice: ReturnType<typeof request.agent>;
  let bob: ReturnType<typeof request.agent>;
  let csrfA: string;
  let csrfB: string;
  let aliceId: string;
  let jobId: string;
  let appId: string;
  const memory = new Map<string, string>();
  const queue = {
    add: vi.fn().mockResolvedValue({ id: 'test-job' }),
    redis: {
      eval: vi.fn().mockResolvedValue(1),
      set: vi.fn(async (k: string, v: string) => {
        memory.set(k, v);
      }),
      get: vi.fn(async (k: string) => memory.get(k) || null),
      del: vi.fn(async (k: string) => memory.delete(k)),
      ping: vi.fn().mockResolvedValue('PONG'),
    },
    queues: {},
  };
  const storage = {
    uploadUrl: vi.fn().mockResolvedValue('https://storage.example.test/upload'),
    head: vi.fn().mockResolvedValue({ ContentLength: 100, ContentType: 'application/pdf' }),
    bytes: vi.fn().mockResolvedValue(Buffer.from('%PDF-')),
    delete: vi.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      const real = postgresDrizzle(pool, { schema });
      await migrate(real, { migrationsFolder: './drizzle' });
      db = real;
      close = () => pool.end();
    } else {
      const pg = new PGlite({ extensions: { vector } });
      await pg.exec(await readFile('./drizzle/0000_eager_meggan.sql', 'utf8'));
      db = drizzle(pg, { schema }) as unknown as DbService['db'];
      close = () => pg.close();
    }
    const module = await Test.createTestingModule({
      imports: [
        DbModule,
        QueueModule,
        StorageModule,
        AuthModule,
        JobsModule,
        ApplicationsModule,
        StatsModule,
        ResumesModule,
        RemindersModule,
        AiModule,
        BillingModule,
        AdminModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: SecurityGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(DbService)
      .useValue({ db })
      .overrideProvider(QueueService)
      .useValue(queue)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ErrorFilter());
    await app.init();
    alice = request.agent(app.getHttpServer());
    bob = request.agent(app.getHttpServer());
    csrfA = (await alice.get('/api/auth/csrf')).body.token;
    csrfB = (await bob.get('/api/auth/csrf')).body.token;
    const suffix = Date.now();
    const a = await alice
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ name: 'Alice', email: `alice-${suffix}@example.com`, password: 'Password123!' })
      .expect(201);
    aliceId = a.body.id;
    await bob
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .send({ name: 'Bob', email: `bob-${suffix}@example.com`, password: 'Password123!' })
      .expect(201);
  });
  afterAll(async () => {
    if (db && aliceId) await db.delete(schema.users).where(eq(schema.users.id, aliceId));
    await app?.close();
    await close?.();
  });
  it('requires auth, returns only safe user fields, and enforces CSRF', async () => {
    await request(app.getHttpServer()).get('/api/jobs').expect(401);
    const me = await alice.get('/api/auth/me').expect(200);
    expect(me.body.passwordHash).toBeUndefined();
    expect(me.body.role).toBe('USER');
    await alice.post('/api/jobs').send({ company: 'A', title: 'B' }).expect(403);
    await alice
      .post('/api/jobs')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', csrfA)
      .send({ company: 'A', title: 'B' })
      .expect(403);
  });
  it('validates jobs, scopes CRUD and supports search', async () => {
    await alice
      .post('/api/jobs')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ company: '', title: '' })
      .expect(400);
    const created = await alice
      .post('/api/jobs')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ company: 'Acme', title: 'Engineer', description: 'TypeScript and PostgreSQL' })
      .expect(201);
    jobId = created.body.id;
    expect((await alice.get('/api/jobs?search=Acme').expect(200)).body.total).toBe(1);
    expect((await bob.get('/api/jobs').expect(200)).body.total).toBe(0);
    await bob.get(`/api/jobs/${jobId}`).expect(404);
    await bob
      .patch(`/api/jobs/${jobId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .send({ company: 'Stolen', title: 'No' })
      .expect(404);
    await bob
      .delete(`/api/jobs/${jobId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .expect(404);
    await alice
      .patch(`/api/jobs/${jobId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ company: 'Acme', title: 'Senior Engineer' })
      .expect(200);
  });
  it('protects relationships, moves atomically, saves notes, and reports stats', async () => {
    await bob
      .post('/api/applications')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .send({ jobId })
      .expect(404);
    const created = await alice
      .post('/api/applications')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ jobId })
      .expect(201);
    appId = created.body.id;
    await alice
      .post('/api/applications')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ jobId })
      .expect(409);
    await bob
      .patch(`/api/applications/${appId}/move`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .send({ status: 'OFFER', position: 0 })
      .expect(404);
    await alice
      .patch(`/api/applications/${appId}/move`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ status: 'INTERVIEW', position: 0 })
      .expect(200);
    await alice
      .patch(`/api/applications/${appId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ notes: 'Prepare examples' })
      .expect(200);
    const board = (await alice.get('/api/applications').expect(200)).body;
    expect(board[0].status).toBe('INTERVIEW');
    expect(board[0].notes).toBe('Prepare examples');
    expect(board[0].appliedAt).toBeTruthy();
    const stats = (await alice.get('/api/stats/me').expect(200)).body;
    expect(stats.counts.INTERVIEW).toBe(1);
    expect(stats.responseRate).toBe(100);
  });
  it('verifies PDF headers, scopes confirmation, and enqueues parsing', async () => {
    const ticket = (
      await alice
        .post('/api/resumes/upload-url')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrfA)
        .send({ fileName: 'resume.pdf', size: 100, contentType: 'application/pdf' })
        .expect(201)
    ).body;
    await bob
      .post('/api/resumes')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .send({ fileKey: ticket.fileKey, fileName: 'resume.pdf' })
      .expect(400);
    const resume = (
      await alice
        .post('/api/resumes')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrfA)
        .send({ fileKey: ticket.fileKey, fileName: 'resume.pdf' })
        .expect(201)
    ).body;
    expect(queue.add).toHaveBeenCalledWith(
      'resume-parse',
      'parse',
      expect.objectContaining({ resumeId: resume.id }),
      `resume-${resume.id}`,
    );
    expect((await alice.get('/api/resumes').expect(200)).body[0].status).toBe('UPLOADED');
    await bob
      .delete(`/api/resumes/${resume.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfB)
      .expect(404);
    await alice
      .delete(`/api/resumes/${resume.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(200);
    expect(storage.delete).toHaveBeenCalled();
  });
  it('protects AI, reminders, billing and admin routes', async () => {
    await alice
      .post(`/api/applications/${appId}/ai`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ type: 'MATCH' })
      .expect(400);
    await bob.get(`/api/applications/${appId}/ai`).expect(404);
    const reminder = (
      await alice
        .post('/api/reminders')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrfA)
        .send({
          applicationId: appId,
          remindAt: new Date(Date.now() + 86400000).toISOString(),
          message: 'Follow up',
        })
        .expect(201)
    ).body;
    expect((await bob.get('/api/reminders').expect(200)).body).toEqual([]);
    await alice
      .delete(`/api/reminders/${reminder.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(200);
    expect((await alice.get('/api/billing').expect(200)).body.limit).toBe(10);
    await alice
      .post('/api/billing/checkout')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(503);
    await alice.get('/api/admin/users').expect(403);
    await alice.get('/api/admin/stats').expect(403);
  });
  it('reserves the last AI credit once under concurrent requests', async () => {
    const [cv] = await db
      .insert(schema.resumes)
      .values({
        userId: aliceId,
        fileKey: `${aliceId}/ready.pdf`,
        fileName: 'ready.pdf',
        status: 'READY',
        parsedText: 'A developer with TypeScript experience.',
      })
      .returning();
    await alice
      .patch(`/api/applications/${appId}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .send({ notes: '', resumeId: cv!.id })
      .expect(200);
    await db
      .insert(schema.usage)
      .values({ userId: aliceId, month: new Date().toISOString().slice(0, 7), aiCalls: 9 });
    const responses = await Promise.all(
      [1, 2].map(() =>
        alice
          .post(`/api/applications/${appId}/ai`)
          .set('Origin', 'http://localhost:3000')
          .set('X-CSRF-Token', csrfA)
          .send({ type: 'MATCH' }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 402]);
    const results = await alice.get(`/api/applications/${appId}/ai`).expect(200);
    expect(results.body).toHaveLength(1);
    expect(results.body[0].status).toBe('PENDING');
    expect((await alice.get('/api/billing')).body.used).toBe(10);
  });
  it('verifies webhook signatures and deduplicates subscription events', async () => {
    const stripe = new Stripe('sk_test_local_only');
    const subscriptionList = vi
      .spyOn(stripe.subscriptions, 'list')
      .mockResolvedValue({
        object: 'list',
        has_more: false,
        url: '',
        data: [
          {
            id: 'sub_local',
            created: 1,
            status: 'active',
            items: { data: [{ current_period_end: 1900000000 }] },
          },
        ],
      } as unknown as Awaited<ReturnType<Stripe['subscriptions']['list']>>);
    const client = vi.spyOn(BillingService.prototype, 'client').mockReturnValue(stripe);
    const originalSecret = env.STRIPE_WEBHOOK_SECRET;
    env.STRIPE_WEBHOOK_SECRET = 'whsec_local_test_only';
    await db
      .insert(schema.subscriptions)
      .values({ userId: aliceId, stripeCustomerId: 'cus_local', status: 'incomplete' });
    const body = JSON.stringify({
      id: `evt_local_${Date.now()}`,
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_local' } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });
    const service = app.get(BillingService);
    try {
      await expect(service.webhook(Buffer.from(body), 'invalid')).rejects.toThrow(
        'Invalid Stripe signature',
      );
      await service.webhook(Buffer.from(body), signature);
      await service.webhook(Buffer.from(body), signature);
      expect(subscriptionList).toHaveBeenCalledTimes(1);
      expect((await db.query.users.findFirst({ where: eq(schema.users.id, aliceId) }))?.plan).toBe(
        'PRO',
      );
    } finally {
      client.mockRestore();
      subscriptionList.mockRestore();
      env.STRIPE_WEBHOOK_SECRET = originalSecret;
    }
  });
  it('rotates refresh tokens once and revokes on logout', async () => {
    const login = await alice
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(201);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find((c) => c.startsWith('refresh_token='))!.split(';')[0]!;
    await alice
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [refresh, `csrf_token=${csrfA}`])
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(401);
    await alice
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrfA)
      .expect(201);
    await alice.get('/api/auth/me').expect(401);
  });
});
