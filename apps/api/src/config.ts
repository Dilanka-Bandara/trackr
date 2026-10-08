import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from '@trackr/shared';
config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  WEB_URL: z.url().default('http://localhost:3000'),
  API_URL: z.url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  S3_ENDPOINT: z.url(),
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.union([z.string().min(8), z.literal('')]).default(''),
  AI_URL: z.url().default('http://localhost:8000'),
  AI_INTERNAL_KEY: z.string().min(32),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_ID: z.string().default(''),
  EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().default('Trackr <hello@trackr.local>'),
  RESEND_API_KEY: z.string().default(''),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SENTRY_DSN: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(''),
  SEED_ADMIN_EMAIL: z.email().default('admin@trackr.dev'),
  SEED_ADMIN_PASSWORD: z.union([z.string().min(12), z.literal('')]).default(''),
});
export const env = schema.parse(process.env);
if (
  env.NODE_ENV === 'production' &&
  (env.JWT_SECRET.includes('change-me') || env.AI_INTERNAL_KEY.includes('change-me'))
)
  throw new Error('Replace development secrets before running in production');
if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY)
  throw new Error('RESEND_API_KEY is required for Resend');
