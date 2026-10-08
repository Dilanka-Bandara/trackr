process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://trackr:trackr-local-only@localhost:5432/trackr_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.AI_INTERNAL_KEY = 'test-ai-secret-with-at-least-32-characters';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_BUCKET = 'trackr-test';
process.env.S3_ACCESS_KEY = 'test-access';
process.env.S3_SECRET_KEY = 'test-secret';
process.env.WEB_URL = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY = '';
process.env.SENTRY_DSN = '';
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = '';
