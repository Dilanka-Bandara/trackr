# Setup and integration checklist

Copy `.env.example` to `.env`, then fill only the integrations you intend to run. Do not paste secret values into source files or commit `.env`.

## Local prerequisites

Verify `node --version`, `pnpm --version`, `docker info`, `python --version`, and `uv --version`. Docker must be running Linux containers. On the build machine, Docker Desktop failed while initializing its inference socket; this is a host problem, not a Compose health failure. Resolve Docker Desktop startup before running the full local stack. Do not factory-reset existing Docker data just to run this project.

If Node package downloads fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on a machine using a trusted enterprise certificate, enable Node's system trust store for the command: PowerShell `$env:NODE_OPTIONS='--use-system-ca'`. For uv use `uv --native-tls sync`. These preserve certificate verification; never use `strict-ssl=false` or disable TLS validation.

## OpenAI or Bedrock

Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY`. `OPENAI_MODEL` and `OPENAI_EMBEDDING_MODEL` are configurable. The default embedding uses 1024 dimensions and must match the migration. For Bedrock, set `LLM_PROVIDER=bedrock`, region and model IDs, and configure an IAM role or the normal AWS credential chain with model access. Titan V2 embeddings support the default dimension.

Restart the AI service after changing its environment. The API and worker need the same `AI_INTERNAL_KEY` as FastAPI. Parsing and AI failures appear in the CV list, saved result, and notification feed. Scanned image-only PDFs need OCR before upload; this implementation extracts embedded PDF text and does not include OCR.

## Google

Create a Google OAuth web client. Set client ID and secret. Register `http://localhost:4000/api/auth/google/callback` for local development and `https://YOUR_DOMAIN/api/auth/google/callback` for production. Existing password accounts are not automatically linked to a Google profile sharing the same email.

## Stripe test mode

Create one monthly recurring price and set its ID, your test secret key, and webhook signing secret. Locally:

```sh
stripe listen --forward-to localhost:4000/api/billing/webhook
```

Subscribe to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Use Stripe's `4242 4242 4242 4242` test card with a future expiry. Configure the Customer Portal in Stripe. Refresh the billing page after webhook processing. The return URL alone never changes a plan.

## Storage and email

MinIO is initialized with a private `trackr-uploads` bucket. `S3_ENDPOINT` is the server-reachable endpoint; `S3_PUBLIC_ENDPOINT` must be reachable from the browser and is included in the presigned signature. For S3/R2 configure CORS to permit your exact web origin, PUT/HEAD, and `Content-Type`, `If-None-Match`, `x-amz-*` headers. AWS Fargate uses task-role credentials with empty static S3 keys. Development files are limited to 5 MB and PDF signatures are checked before processing.

Use `EMAIL_PROVIDER=smtp` for Mailpit. For production, select `resend`, configure `RESEND_API_KEY`, and use a verified sending domain in `EMAIL_FROM`. Test reminders with a time at least five minutes in the future. The scheduler checks due reminders every five minutes.

## Observability

Set Sentry DSNs to enable error capture. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to an OTLP HTTP collector base URL to export traces. HTTP request context is injected into BullMQ jobs and worker-to-AI headers. Without these values, telemetry export is disabled. Do not enable verbose provider request logging with private CV content.

## Manual product walk-through

1. Open `/register`; create an account. Check `/api/auth/me` returns only safe profile fields.
2. Open Saved jobs, save a role and check "Add to my application board".
3. Open Application board; drag the card into Applied. Reload and confirm its stage persists.
4. Open the card, write notes, save, and schedule a reminder.
5. Upload a text-based PDF under My CVs. With AI configured, wait for the ready notification.
6. Select that CV on the application. Analyze a match, draft a cover letter, copy it, and generate interview questions.
7. Confirm dashboard counts, reminders in Mailpit, and usage in Settings & billing.
8. Complete Stripe test Checkout and verify the webhook upgrades the account.
9. Sign in as a separately seeded administrator to inspect `/admin` and `/api/admin/queues`.
