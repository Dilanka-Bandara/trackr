# Validation status

Verified on 2026-10-08. This records executed checks, not a claim of a live deployment.

| Check                                                          | Result                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm lint`                                                    | Passed                                                            |
| `pnpm typecheck`                                               | Passed                                                            |
| `pnpm test`                                                    | 15 tests passed across API, shared schemas, and web utilities     |
| `pnpm build`                                                   | API/shared compiled; Next production build generated all 13 pages |
| `uv run pytest` in `services/ai`                               | 4 passed                                                          |
| `uv run ruff check .` in `services/ai`                         | Passed                                                            |
| `pnpm test:e2e`                                                | 2 Chromium tests passed; 1 live-stack test skipped                |
| Development and production `docker compose ... config --quiet` | Passed configuration checks                                       |
| Terraform initialization, validation, and `terraform test`     | Passed in Linux/WSL; 1 mocked-provider plan test passed           |

## What the tests establish

Local API integration tests execute the SQL migration against PGlite with pgvector. They exercise authentication, CSRF, ownership, job/application mutations, CV confirmation, quota concurrency, refresh rotation, and signed Stripe webhook handling. Redis, queues, storage, and Stripe network calls are mocked. They do not establish working S3 uploads, queue delivery, or actual billing.

Python tests use a fake provider to verify validation, internal authentication, retry behavior, and streaming without sending private data or spending AI credits.

Browser checks cover public pages, fixture-backed dashboard and board interactions, dialogs, hydration errors, and a 375px mobile layout. Private-page API responses are intercepted with explicit test fixtures. Screenshot artifacts are in `apps/web/test-results` after running the tests.

The opt-in `E2E_LIVE=1` test covers registration, job tracking, PDF processing, match analysis, and streamed cover letters. CI is configured to run it against PostgreSQL, Redis, MinIO, and a test-only fake AI server. That CI workflow has been authored but has not been executed on a remote repository in this session.

## Local environment blockers

Docker Desktop's Linux engine did not start successfully. Its startup error reports that `AppData/Local/Docker/run/dockerInference` cannot be accessed while initializing the inference manager. No reset or deletion of Docker data was attempted. Consequently, container image builds, the seeded full application, and the live-stack browser test remain unverified here. Repair Docker Desktop, then follow `setup.md` to migrate, seed, and run the stack.

Windows Terraform provider startup encountered a localhost TLS certificate error. Running the same configuration and locked providers inside WSL succeeded. The Terraform test uses mocked providers: it does not contact an AWS account or prove permissions, quotas, certificates, or image availability.

This machine required Node's system certificate support for package downloads (`NODE_OPTIONS=--use-system-ca`) and uv's `--native-tls` option. Certificate verification was not disabled.

## External integrations and deployment

Real OpenAI/Bedrock generation, Google sign-in, Stripe Checkout/Portal, Resend delivery, Sentry reporting, and cloud storage require the operator's credentials and service configuration. No real end-to-end transactions with those services were performed. Mailpit and the supplied test doubles are development tools, not proof of real delivery.

Docker, CI, Caddy, backup, SSH deployment, and AWS Terraform files are included. No cloud resources were provisioned, no public deployment was made, and no learning reflections were written on the user's behalf. See `architecture.md` for remaining production-hardening considerations and `deploy.md` for deployment steps.
