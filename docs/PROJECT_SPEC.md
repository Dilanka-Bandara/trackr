# AGENTS.md — Trackr

> This file is the instruction manual for AI coding agents (Codex) working in this repo.
> Read this whole file before writing any code. Follow it on every task.

---

## 1. What we are building

**Trackr** is an AI-powered job application tracker (SaaS).

Users can:

- Sign up / log in (email + password, Google).
- Upload their CV (PDF). The system parses it in the background.
- Save job postings (company, title, URL, description).
- Track applications on a Kanban board: `WISHLIST → APPLIED → INTERVIEW → OFFER → REJECTED`.
- Get AI help per application: **match score** (CV vs job), **cover letter** (streamed), **interview questions**.
- Receive real-time notifications and email reminders.
- Upgrade to **Pro** (Stripe subscription) for more AI usage.

Admins can see a dashboard with users, usage and revenue stats.

**Purpose of the project:** learning full-stack development end-to-end and a portfolio/CV project.
Code must therefore be **clean, readable, well-structured and commented where the "why" is not obvious**.

---

## 2. Tech stack (do not change without asking)

| Area                   | Choice                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo               | Turborepo + pnpm workspaces                                                                                                                |
| Language               | TypeScript (strict) everywhere except the AI service (Python 3.12)                                                                         |
| Frontend               | Next.js (App Router), React, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod                                                 |
| Main API               | NestJS (REST), Swagger/OpenAPI                                                                                                             |
| Auth                   | NestJS + Passport: JWT access token + refresh token in **httpOnly cookies**, Google OAuth, argon2 password hashing, roles `USER` / `ADMIN` |
| Database               | PostgreSQL 16 + pgvector, Drizzle ORM + drizzle-kit migrations                                                                             |
| Queue / cache          | Redis + BullMQ                                                                                                                             |
| AI service             | FastAPI (Python), managed with `uv`, Pydantic models                                                                                       |
| LLM                    | Provider-agnostic interface; implementations for AWS Bedrock and OpenAI, chosen by env var                                                 |
| File storage           | S3 API — MinIO locally, AWS S3 / Cloudflare R2 in production                                                                               |
| Real-time              | Socket.IO (notifications), Server-Sent Events (streaming AI text)                                                                          |
| Email                  | Resend + React Email (Mailpit locally)                                                                                                     |
| Payments               | Stripe (test mode) — Checkout, Customer Portal, webhooks                                                                                   |
| Testing                | Vitest (unit), Supertest (API integration), Playwright (E2E), pytest (AI service)                                                          |
| Logging / monitoring   | pino (JSON logs), Sentry, OpenTelemetry                                                                                                    |
| Containers             | Docker (multi-stage builds), Docker Compose                                                                                                |
| Reverse proxy          | Caddy (automatic HTTPS)                                                                                                                    |
| CI/CD                  | GitHub Actions → GitHub Container Registry (GHCR) → deploy to VPS over SSH                                                                 |
| Infrastructure as Code | Terraform (AWS)                                                                                                                            |

Always use the **latest stable** version of each package unless a version is pinned in this file.

---

## 3. Repository structure

```
trackr/
├── apps/
│   ├── web/                 # Next.js frontend            (port 3000)
│   └── api/                 # NestJS API + BullMQ worker  (port 4000)
│       └── src/
│           ├── main.ts      # HTTP server entry
│           ├── worker.ts    # BullMQ worker entry (separate container)
│           └── modules/     # auth, users, jobs, applications, resumes, ai, notifications,
│                            # reminders, billing, admin, storage, health
├── services/
│   └── ai/                  # FastAPI AI service          (port 8000)
├── packages/
│   ├── shared/              # Zod schemas, shared TS types, enums, constants
│   └── config/              # shared tsconfig, eslint, prettier configs
├── infra/
│   ├── caddy/Caddyfile
│   ├── terraform/           # AWS infrastructure
│   └── scripts/             # backup, deploy helper scripts
├── docs/
│   ├── LEARNING.md          # what I learned per step (written by the human)
│   ├── TECH_STACK.md
│   └── architecture.md
├── .github/workflows/       # ci.yml, deploy.yml
├── docker-compose.yml       # local development
├── docker-compose.prod.yml  # production
├── .env.example
└── AGENTS.md
```

---

## 4. Local services and ports

| Service                   | Port        | Notes                                  |
| ------------------------- | ----------- | -------------------------------------- |
| web (Next.js)             | 3000        |                                        |
| api (NestJS)              | 4000        | Swagger at `/api/docs`                 |
| ai (FastAPI)              | 8000        | Docs at `/docs`, internal only in prod |
| postgres (pgvector image) | 5432        |                                        |
| redis                     | 6379        |                                        |
| minio                     | 9000 / 9001 | 9001 = web console                     |
| mailpit                   | 1025 / 8025 | 8025 = inbox UI for dev emails         |

---

## 5. Commands

```bash
pnpm install                 # install all JS dependencies
docker compose up -d         # start postgres, redis, minio, mailpit (and apps once dockerized)
pnpm dev                     # run web + api + worker in dev mode (turbo)
pnpm build                   # build everything
pnpm lint                    # lint everything
pnpm typecheck               # TypeScript checks
pnpm test                    # unit + integration tests
pnpm test:e2e                # Playwright tests
pnpm db:generate             # create a migration from schema changes
pnpm db:migrate              # apply migrations
pnpm db:seed                 # load demo data
cd services/ai && uv run pytest     # AI service tests
```

Keep these commands working. If you add a new command, add it here.

---

## 6. Data model (source of truth)

All tables have `id` (uuid, default random), `created_at`, `updated_at`.

- **users**: email (unique), password_hash (nullable for Google users), name, avatar_url, role (`USER`|`ADMIN`), google_id (nullable, unique), plan (`FREE`|`PRO`)
- **refresh_tokens**: user_id, token_hash, expires_at, revoked_at
- **resumes**: user_id, file_key, file_name, status (`UPLOADED`|`PARSING`|`READY`|`FAILED`), parsed_text, parsed_json (jsonb: skills, experience, education), embedding (vector)
- **jobs**: user_id, company, title, url, location, salary_text, description, embedding (vector)
- **applications**: user_id, job_id, resume_id (nullable), status (`WISHLIST`|`APPLIED`|`INTERVIEW`|`OFFER`|`REJECTED`), position (int, ordering inside a column), applied_at, notes
- **ai_results**: application_id, type (`MATCH`|`COVER_LETTER`|`INTERVIEW_QUESTIONS`), status (`PENDING`|`DONE`|`FAILED`), score (nullable int 0–100), content (jsonb)
- **reminders**: application_id, user_id, remind_at, message, sent_at (nullable)
- **notifications**: user_id, type, title, body, read_at (nullable)
- **subscriptions**: user_id (unique), stripe_customer_id, stripe_subscription_id, status, current_period_end
- **usage**: user_id, month (`YYYY-MM`), ai_calls (int) — unique on (user_id, month)
- **stripe_events**: stripe_event_id (unique) — for webhook idempotency

Every query on user-owned data **must** filter by `user_id` (no user can read another user's data).

---

## 7. Coding rules (always follow)

### General

1. Small, focused changes. One task = one feature. Do not rewrite unrelated code.
2. TypeScript `strict: true`. **No `any`** unless commented with a reason.
3. Validate all external input (HTTP bodies, query params, env vars, webhook payloads, LLM output).
   - TypeScript: Zod schemas, preferably from `packages/shared`.
   - Python: Pydantic models.
4. Never hard-code secrets. Read from env vars; add every new var to `.env.example` with a comment.
5. Env vars are validated at startup — the app must fail fast with a clear message if one is missing.
6. Add a short comment explaining **why** for any non-obvious decision (the human is learning).
7. Names: files `kebab-case`, React components `PascalCase`, variables `camelCase`, DB columns `snake_case`.

### Backend (NestJS)

- One NestJS module per feature (`controller`, `service`, `dto`, `*.spec.ts`).
- Controllers are thin: validate → call service → return. Business logic lives in services.
- Use Drizzle only through an injected `DbService`; no raw SQL strings except for pgvector similarity queries.
- Return consistent errors: `{ statusCode, message, error }`. Use Nest exceptions.
- Every endpoint documented with Swagger decorators.
- Slow work (AI, parsing, email) **never** runs inside an HTTP request — enqueue a BullMQ job.
- Jobs must be **idempotent** and have retries with exponential backoff.

### Frontend (Next.js)

- App Router. Server Components by default; add `"use client"` only when needed (state, effects, browser APIs).
- Server data in the browser goes through TanStack Query hooks in `apps/web/src/hooks/`.
- One API client in `apps/web/src/lib/api.ts` (uses `fetch`, `credentials: "include"`).
- Forms: React Hook Form + Zod resolver with the shared schema.
- UI: shadcn/ui components; Tailwind for layout. Must work on mobile width (375px).
- Every page handles **loading**, **empty** and **error** states.

### AI service (FastAPI)

- Internal service: only the API/worker calls it. Protect with a shared secret header `X-Internal-Key`.
- LLM access only through `LLMProvider` interface (`complete`, `stream`, `embed`).
- Prompts live in `services/ai/app/prompts/` as separate files, not inline strings.
- Always ask the LLM for JSON where structured data is needed and validate with Pydantic; retry once on invalid JSON.

### Tests

- Every new service function gets unit tests. Every new endpoint gets at least one integration test.
- Tests must not call real external APIs (LLM, Stripe, Resend) — mock them.

### Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Before finishing a task run: `pnpm lint && pnpm typecheck && pnpm test`. Fix failures.

---

## 8. Definition of done (every task)

- [ ] Code builds, lint + typecheck + tests pass.
- [ ] New env vars added to `.env.example`.
- [ ] Swagger updated for new endpoints.
- [ ] Loading / empty / error states for new UI.
- [ ] At the end of your reply, give the human a **"What I built & why"** summary:
  1. Files created/changed.
  2. The key concept used (e.g. "presigned URL", "idempotent webhook") explained in 3–5 simple sentences.
  3. How to test it manually (exact steps / URLs).

---

## 9. Build plan — step by step

> **Human:** work through the steps in order. For each step, copy the **Prompt** into Codex.
> When it's done, check **Done when**, then write 3–5 lines in `docs/LEARNING.md` answering **Learn**.
> Commit after every step.

### Phase 0 — Prepare your machine (human, no AI)

Install: Git, Node.js (LTS), pnpm (`corepack enable`), Docker Desktop, Python 3.12, `uv`, VS Code, Codex.
Create an empty GitHub repo `trackr`, clone it, put this `AGENTS.md` in the root, commit.

---

### Phase 1 — Foundation (week 1)

#### Step 1.1 — Monorepo skeleton

**Prompt:**

> Read AGENTS.md. Set up the Turborepo + pnpm monorepo exactly as in section 3: empty Next.js app in `apps/web`, empty NestJS app in `apps/api`, `packages/shared` (exports Zod + a sample schema), `packages/config` (shared tsconfig strict, eslint, prettier). Add root scripts from section 5 (stubs are fine for db scripts). Add `.gitignore`, `.editorconfig`, `.env.example`, and a README with how to run.

**Done when:** `pnpm install && pnpm dev` starts web on 3000 and api on 4000; `pnpm lint` and `pnpm typecheck` pass.
**Learn:** What is a monorepo? What does Turborepo do? Why share a package between web and api?

#### Step 1.2 — Local infrastructure with Docker Compose

**Prompt:**

> Create `docker-compose.yml` for local development with: postgres (use the `pgvector/pgvector:pg16` image, named volume, healthcheck), redis (healthcheck), minio (create bucket `trackr-uploads` on startup with a minio/mc init container), and mailpit. Use ports from AGENTS.md section 4. Read credentials from `.env`. Document every service with comments.

**Done when:** `docker compose up -d` → all containers healthy; MinIO console on :9001 shows the bucket; Mailpit on :8025.
**Learn:** What is a container vs an image? What are volumes and why does Postgres need one? What is a healthcheck?

#### Step 1.3 — API skeleton

**Prompt:**

> In `apps/api`: add config module with Zod-validated env vars (fail fast), pino JSON logging with request IDs, global validation, global exception filter returning `{statusCode,message,error}`, CORS for `http://localhost:3000` with credentials, Helmet, Swagger at `/api/docs`, and `GET /health` that checks Postgres and Redis. Prefix all routes with `/api`.

**Done when:** `http://localhost:4000/api/health` returns ok for db + redis; Swagger page loads.
**Learn:** What is middleware? What is CORS and why is it needed? Why validate env vars at startup?

#### Step 1.4 — Database schema and migrations

**Prompt:**

> Add Drizzle ORM to `apps/api` with a `DbService`. Create the full schema from AGENTS.md section 6 (enable the `vector` extension in the first migration; embedding dimension from env `EMBEDDING_DIM`, default 1024). Add indexes on all foreign keys and on `(user_id, status, position)` for applications. Wire `pnpm db:generate`, `db:migrate`, `db:seed`. Seed: one admin, one demo user (`demo@trackr.dev` / `Demo1234!`), 6 jobs, 6 applications across statuses.

**Done when:** migrations run on a fresh DB; seed data visible (use `pnpm drizzle-kit studio`).
**Learn:** What is a migration and why not edit tables by hand? What is a foreign key? Why add indexes?

#### Step 1.5 — Authentication

**Prompt:**

> Build the `auth` and `users` modules: register, login, logout, refresh, `GET /auth/me`, Google OAuth. Passwords hashed with argon2. Access token JWT (15 min) and refresh token (7 days, stored hashed in `refresh_tokens`, rotated on every refresh) — both in httpOnly, secure-in-prod, sameSite=lax cookies. Add `JwtAuthGuard`, `RolesGuard` and `@CurrentUser()` decorator. Shared Zod schemas for register/login in `packages/shared`. Write unit + integration tests.

**Done when:** you can register, log in, call `/auth/me`, refresh and log out via Swagger; tests pass.
**Learn:** Access vs refresh token? Why httpOnly cookies instead of localStorage? What does hashing protect against?

#### Step 1.6 — Frontend shell and auth pages

**Prompt:**

> In `apps/web`: set up Tailwind, shadcn/ui, TanStack Query provider, `lib/api.ts` client (auto-refresh on 401 once, then redirect to login), dark/light theme. Pages: landing page (`/`), `/login`, `/register` (React Hook Form + shared Zod schemas, "Continue with Google", "Try demo account" button), and a protected `/app` layout with sidebar (Dashboard, Board, Jobs, CVs, Settings) and user menu. Protect `/app/*` with Next.js middleware checking the auth cookie.

**Done when:** register → land on `/app`; logout → back to `/login`; demo button logs in the seed user.
**Learn:** Server vs Client Components? What does TanStack Query cache? How does the middleware protect routes?

#### Step 1.7 — Dockerize the apps (dev)

**Prompt:**

> Add multi-stage Dockerfiles for `apps/web`, `apps/api` (also used for the worker with a different command) and `services/ai` (FastAPI hello-world with `/health`, managed by uv). Add these services to `docker-compose.yml` with dev hot-reload via bind mounts, `depends_on` with health conditions, and a shared network. Add `.dockerignore` files.

**Done when:** `docker compose up --build` runs the entire system; web works at :3000 against the dockerized api.
**Learn:** What is a multi-stage build and why are images smaller? How do containers find each other by service name?

---

### Phase 2 — Core features (week 2)

#### Step 2.1 — Jobs CRUD

**Prompt:**

> Build the `jobs` module: create, list (pagination, search by company/title, sort), get, update, delete — scoped to current user. Frontend `/app/jobs`: table with search + pagination, create/edit dialog, delete with confirm, optimistic updates. Tests for ownership (user A cannot read user B's job).

**Done when:** full CRUD works; ownership test passes.
**Learn:** REST verbs and status codes. Why is pagination needed? What is an optimistic update?

#### Step 2.2 — Applications Kanban board

**Prompt:**

> Build the `applications` module including `PATCH /applications/:id/move` that changes status and position inside a DB transaction. Frontend `/app/board`: 5 columns, drag and drop with `@dnd-kit`, optimistic move with rollback on error, card shows company/title/days since applied/match score badge. Click a card → detail drawer with notes and timeline.

**Done when:** dragging cards persists after page refresh; failed request rolls back the card.
**Learn:** What is a DB transaction and why is it needed for reordering?

#### Step 2.3 — CV upload with presigned URLs

**Prompt:**

> Build `storage` and `resumes` modules. Flow: `POST /resumes/upload-url` returns a presigned S3 PUT URL (PDF only, max 5 MB) → browser uploads directly to MinIO → `POST /resumes` confirms with the file key → status `UPLOADED`. Frontend `/app/cvs`: drag-and-drop uploader with progress bar, list of CVs with status badge, delete (also removes the file).

**Done when:** a PDF appears in the MinIO bucket and the CV list.
**Learn:** What is a presigned URL and why doesn't the file go through our API?

#### Step 2.4 — Dashboard

**Prompt:**

> Add `GET /stats/me` (counts per status, applications per week for the last 8 weeks, response rate). Frontend `/app` dashboard: stat cards + bar chart (Recharts) + "recent activity" list. Add skeleton loaders.

**Done when:** dashboard reflects seed data and updates after board changes.
**Learn:** Aggregation queries (`GROUP BY`). Why compute stats on the server?

---

### Phase 3 — Background jobs and AI (week 3)

#### Step 3.1 — BullMQ queues and worker

**Prompt:**

> Add BullMQ with queues `resume-parse`, `ai-tasks`, `emails`, `reminders`. `apps/api/src/worker.ts` starts processors as a separate process/container. Retries: 3 attempts, exponential backoff. Add Bull Board UI at `/api/admin/queues` (admin only). Add a `worker` service to docker-compose.

**Done when:** a test job enqueued from the API is processed by the worker and visible in Bull Board.
**Learn:** Why use a queue instead of doing work in the request? What does "idempotent job" mean?

#### Step 3.2 — AI service foundations

**Prompt:**

> In `services/ai`: FastAPI app with settings via pydantic-settings, `X-Internal-Key` auth dependency, `LLMProvider` interface with `BedrockProvider` and `OpenAIProvider` (select via `LLM_PROVIDER` env), endpoints: `POST /parse-resume` (text in → structured JSON: skills, experience, education), `POST /embed` (texts → vectors). Prompts in `app/prompts/`. pytest tests with a fake provider.

**Done when:** `/docs` shows endpoints; tests pass with the fake provider.
**Learn:** Why is the AI a separate service? What is an embedding?

#### Step 3.3 — CV parsing pipeline

**Prompt:**

> When a resume is confirmed, enqueue `resume-parse`: worker downloads PDF from S3, extracts text (`pdf-parse`), calls AI `/parse-resume` and `/embed`, saves `parsed_text`, `parsed_json`, `embedding`, sets status `READY` (or `FAILED` with error). Also embed job descriptions on create/update. Frontend: CV detail page showing extracted skills; status updates via polling for now.

**Done when:** uploading a CV ends in `READY` with skills shown.
**Learn:** Trace the whole flow: browser → S3 → API → queue → worker → AI → DB.

#### Step 3.4 — Match score

**Prompt:**

> Add `POST /applications/:id/ai/match`: enqueue job → worker computes cosine similarity with pgvector between resume and job embeddings, then asks the LLM for strengths, gaps and a 0–100 score (JSON, Pydantic-validated). Store in `ai_results`. Frontend: "Analyze match" button in the application drawer, score ring + strengths/gaps lists.

**Done when:** match result shows for a seeded application.
**Learn:** What is cosine similarity? Why combine vector similarity with an LLM judgment?

#### Step 3.5 — Streaming cover letter and interview questions

**Prompt:**

> AI service: `POST /cover-letter/stream` (streams tokens) and `POST /interview-questions` (JSON list with category + tip). API: SSE endpoint `GET /applications/:id/ai/cover-letter/stream` that proxies the AI stream and saves the final text. Frontend: text appears word by word, with Copy and Regenerate buttons, tone selector (formal/friendly). Count each AI call in `usage`.

**Done when:** cover letter streams live in the browser and is saved.
**Learn:** What is SSE vs WebSocket? Why stream LLM output?

---

### Phase 4 — Product features (week 4)

#### Step 4.1 — Real-time notifications

**Prompt:**

> Add Socket.IO gateway in the API, authenticated by the access-token cookie; each user joins room `user:{id}`. The worker publishes events through Redis (Socket.IO Redis adapter) when a CV is parsed or an AI result is ready. Save in `notifications`. Frontend: bell icon with unread count, dropdown list, toast on new event; replace CV status polling with sockets.

**Done when:** a notification pops up when parsing finishes, without refresh.
**Learn:** Why does the worker need Redis to talk to the socket server? What is pub/sub?

#### Step 4.2 — Emails and reminders

**Prompt:**

> Email module using Resend in prod and SMTP to Mailpit in dev (choose by env). React Email templates: welcome, reminder, weekly summary. Reminders: user sets "remind me to follow up" date on an application; a repeatable BullMQ job every 5 minutes sends due reminders (set `sent_at`, never send twice). Weekly summary every Monday 8:00.

**Done when:** reminder email appears in Mailpit at the due time, only once.
**Learn:** What are cron/repeatable jobs? How do we guarantee "exactly once" sending?

#### Step 4.3 — Stripe subscriptions

**Prompt:**

> Billing module: `POST /billing/checkout` (Stripe Checkout, Pro monthly price from env), `POST /billing/portal` (Customer Portal), `POST /billing/webhook` (raw body, verify signature, idempotent using `stripe_events`) handling `checkout.session.completed`, `customer.subscription.updated/deleted` to update `subscriptions` and `users.plan`. Plan limits: FREE = 10 AI calls/month, PRO = 200; return 402 with a clear message when exceeded. Frontend: `/app/settings/billing` and `/pricing` page, upgrade button, usage meter.

**Done when:** test card `4242 4242 4242 4242` upgrades the user to PRO (use `stripe listen` locally).
**Learn:** What is a webhook? Why verify the signature? Why store processed event IDs?

#### Step 4.4 — Admin dashboard

**Prompt:**

> Admin-only module + `/admin` pages: users table (search, plan, role, created), totals (users, PRO users, AI calls this month, MRR from active subscriptions), signups chart. Guard with `RolesGuard(ADMIN)` on API and route protection in the frontend.

**Done when:** admin sees the dashboard; a normal user gets 403.
**Learn:** Authentication vs authorization.

---

### Phase 5 — Quality and security (week 5)

#### Step 5.1 — Tests

**Prompt:**

> Raise coverage: unit tests for all services, integration tests (Supertest + a test Postgres via Docker) for auth, jobs, applications, billing webhook. Playwright E2E: register → add job → move card → upload CV → see dashboard. Add `pnpm test:e2e`.

**Done when:** all tests pass locally with one command.
**Learn:** Unit vs integration vs E2E — what does each catch?

#### Step 5.2 — Security hardening

**Prompt:**

> Add rate limiting (`@nestjs/throttler` with Redis storage): strict on auth routes and AI routes. CSRF protection for cookie-based mutations (double-submit token). Security headers on web (CSP). Check file uploads by content type and size. Add an `OWASP checklist` section to `docs/architecture.md` describing what we protect against.

**Done when:** spamming login returns 429; checklist written.
**Learn:** What is CSRF and why do cookies make it a risk? What is rate limiting for?

#### Step 5.3 — Observability

**Prompt:**

> Add Sentry to web, api, worker and ai service (DSN from env, disabled if empty). Add OpenTelemetry tracing so one request is traceable across api → worker → ai service (propagate trace context in job data and HTTP headers). Structured logs include `requestId`, `userId`.

**Done when:** a thrown test error appears in Sentry with a trace.
**Learn:** Logs vs metrics vs traces.

---

### Phase 6 — Ship it (week 6)

#### Step 6.1 — Production Docker setup

**Prompt:**

> Create `docker-compose.prod.yml`: production images (no bind mounts, non-root users, `NODE_ENV=production`), Caddy in front (`infra/caddy/Caddyfile`: domain → web, `/api` and `/socket.io` → api, automatic HTTPS), ai service not exposed publicly, restart policies, resource limits, a one-off `migrate` service that runs before api starts. Postgres backup script to S3 daily (`infra/scripts/backup.sh`).

**Done when:** `docker compose -f docker-compose.prod.yml up` works locally with `localhost`.
**Learn:** What does a reverse proxy do? Why must containers not run as root?

#### Step 6.2 — CI pipeline

**Prompt:**

> `.github/workflows/ci.yml`: on PR and push — pnpm install with cache, lint, typecheck, unit + integration tests (Postgres + Redis as service containers), pytest for AI service, build Docker images. On push to `main`, push images to GHCR tagged with the commit SHA and `latest`.

**Done when:** a PR shows green checks; images appear in GitHub Packages.
**Learn:** What is CI? Why tag images with the commit SHA?

#### Step 6.3 — Deploy to a VPS

**Prompt:**

> `.github/workflows/deploy.yml`: after CI on `main`, SSH to the server (secrets: host, user, key), `docker compose pull`, run migrations, `docker compose up -d`, then hit `/api/health`; fail the job if unhealthy. Write `docs/deploy.md`: server setup steps (create user, SSH keys, UFW firewall 22/80/443, install Docker, DNS A record, `.env` on server).

**Done when:** pushing to `main` updates the live site automatically.
**Learn:** What is CD? What happens if a deploy fails and how do we roll back (previous SHA tag)?

#### Step 6.4 — Terraform for AWS (portfolio showcase)

**Prompt:**

> In `infra/terraform`: modules for VPC, ECS Fargate services (web, api, worker, ai), RDS Postgres, ElastiCache Redis, S3 bucket, ALB with HTTPS (ACM), Secrets Manager for env vars, CloudWatch logs. Variables + outputs, remote state in S3. README explaining `terraform plan/apply/destroy` and estimated cost warning.

**Done when:** `terraform validate` and `terraform plan` succeed. (Apply only when you want screenshots, then `destroy`.)
**Learn:** What is Infrastructure as Code? What is Terraform state?

#### Step 6.5 — Portfolio polish

**Prompt:**

> Write a great README: one-line pitch, live demo link + demo credentials, screenshots/GIF placeholders, architecture diagram (Mermaid), tech stack table, features list, how to run locally (3 commands), testing, deployment, "what I learned". Add `docs/architecture.md` with request-flow diagrams for: login, CV upload → parse, cover letter streaming, Stripe webhook.

**Done when:** a stranger can understand and run the project from the README alone.

---

## 10. How the human should work with you (Codex)

- Give one step at a time. If a step is too big, split it (e.g. "Step 1.5 part A: register + login only").
- After each step, the human may ask: _"Explain this code like I'm new to it"_ — answer simply, with an analogy.
- If something is unclear or conflicts with this file, **ask before guessing**.
- If you change an architectural decision, update this file in the same commit.
