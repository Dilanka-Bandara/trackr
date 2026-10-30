# Validation status

## Local AI activation — 30 October 2026

At the user's request, downloaded `qwen3-embedding:0.6b`, retained the installed `qwen2.5:7b`, and switched the ignored local `.env` to Ollama. Both job and resume embedding columns were empty before switching. Real embedding inference returned 1024 dimensions. Real HTTP requests for CV parsing, matching, interview questions, and streamed cover letters all succeeded, using synthetic data and no paid AI provider.

Started PostgreSQL on 55432, the existing Redis service on 6379, Mailpit, the web/API/worker processes, and FastAPI. Ran the database migration successfully. API health reports PostgreSQL and Redis healthy. Demo login passed in installed Chrome.

The upstream MinIO Docker Hub image was unavailable, and attempts to pull its Quay image also failed. Built the official archived source at revision `7aac2a2c5b7c` locally instead. `compose.local-storage.yaml` and `infra/local/Minio.Dockerfile` reproduce this development workaround. The local-only initialization script created the private bucket and passed a second, idempotent run. Compose validation and the source image build passed. This storage workaround has not been approved or tested as a public hosting setup.

Fixed the combined API/worker development launcher to invoke the actual tsx CLI for watch mode; its previous Node invocation treated `watch` as a filename. Fixed the live browser test's CV selector to accommodate option text in the wrapping label's accessible name. Lint, typechecking, all 17 TypeScript tests, and the API production build passed. All 12 Python tests passed. The frontend production build had passed in the preceding adapter change; no frontend application code changed in this activation.

A separate real Chrome browser smoke journey (with longer local-inference waits) passed registration, job creation, stage/notes persistence, PDF upload, worker parsing and embedding, CV selection, match display, cover-letter display, interview-question display, and dashboard counts. No API or provider responses were mocked in that journey. Database inspection confirmed MATCH, COVER_LETTER, and INTERVIEW_QUESTIONS records all reached DONE. Synthetic test accounts/data remain in the local development database. The standard CI live test still uses a fake provider and is distinct from this manual smoke run.

These results supersede the earlier unverified local-embedding/full-workflow notes below. The services were left running locally. No public deployment or cloud AI service was activated. Restart instructions are in `LOCAL_AI.md`.

## Local AI adapter — 30 October 2026

Added an Ollama provider for JSON generation, streaming cover letters, and embeddings. All 12 Python tests passed (4 existing API tests and 8 local-provider tests), and Ruff checks passed. HTTP provider tests use mocks; no paid API is called. A separate real local smoke test used the already installed `qwen2.5:7b` model and a synthetic CV: parsing returned validated skills (`Python`, `SQL`, `React`) and education. This verifies local generation for that example, not overall model quality.

No embedding model was installed during this change, and no model downloads were initiated. End-to-end local embeddings, matching, and the full PDF/worker/browser workflow remain unverified. `.env` was not switched to Ollama automatically. See `LOCAL_AI.md` for activation and embedding-model compatibility requirements. No hosting resources were created.

The final monorepo checks also passed: `pnpm lint`, `pnpm typecheck`, all 17 TypeScript tests, and `pnpm build`, including Next.js standalone packaging. This successful rerun supersedes the earlier Windows packaging failure recorded below; no generated-folder cleanup was needed for this run.

## Account settings update — 30 October 2026

Added profile name editing and current-password-verified password changes, with refresh-session revocation and Google-only account handling. Lint and type checks passed; 17 TypeScript tests passed, including two additional database-backed API tests. Three browser scenarios passed (public pages, dashboard/board, and account settings), with the settings test also checking mobile layout, persistence, confirmation validation, and the sign-in redirect. The opt-in live-stack browser scenario was not run. The installed Google Chrome channel was used via `PLAYWRIGHT_CHANNEL=chrome` because the Playwright-managed browser executable was absent.

API/shared builds passed. The frontend compiled, typechecked, and generated pages, but the complete Windows production build failed during standalone packaging with `EPERM` at `.next/standalone/node_modules/.pnpm/react@19.3.0/node_modules/react`. A generated-folder cleanup attempt was rejected by automatic approval review; no cleanup was performed. Linux container/ARM64 builds and remote deployment remain unverified. This latest result supersedes the earlier successful frontend-build entry below.

The free-hosting guide in `FREE_HOSTING.md` documents a proposed Oracle Always Free route and provider limitations. No cloud resources were created and no external services were activated.

## Initial build and local setup — 8 October 2026

Verified on 2026-10-08. This records executed checks, not a claim of a live deployment.

Follow-up local setup: Docker subsequently became available. A dedicated pgvector PostgreSQL container now runs on host port 55432 to avoid the existing native PostgreSQL installations. The actual database migration and demo seed completed successfully. The earlier Docker-startup blocker below describes the initial build session; full-stack integration validation remains separate from this database check.

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
