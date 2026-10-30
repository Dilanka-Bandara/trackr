# Trackr — Project Brief for CV and Portfolio Writing

Prepared: 8 October 2026

## Purpose of this document

This document gives a CV-writing LLM factual context about Trackr. Use it to produce concise, role-relevant project descriptions and interview talking points. Distinguish implemented functionality from locally verified behavior and externally configured integrations. Do not invent user numbers, revenue, performance improvements, employment history, development dates, team size, or deployment achievements.

The project was developed with AI coding assistance. The repository demonstrates implementation scope; it does not independently establish how much code the candidate personally wrote or their proficiency in every listed technology. Confirm the candidate's contribution and understanding before attributing individual achievements. Do not describe the work as entirely unaided or as professional employment without confirmation.

## Repository and project identity

| Field              | Details                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Project name       | Trackr                                                                                       |
| Description        | AI-powered job application tracker with SaaS subscription functionality                      |
| GitHub repository  | https://github.com/Dilanka-Bandara/trackr                                                    |
| Repository owner   | Dilanka-Bandara                                                                              |
| Repository name    | trackr                                                                                       |
| Main branch        | main                                                                                         |
| Project category   | Full-stack web application; personal portfolio and learning project                          |
| Primary languages  | TypeScript, Python, SQL; Terraform HCL for infrastructure                                    |
| Local execution    | Next.js frontend, NestJS API, background worker, Python AI service, PostgreSQL and Redis     |
| Public demo        | No verified public deployment URL available                                                  |
| Development period | Not established; ask the candidate rather than inferring from the six-week reference roadmap |
| License            | Not established in this brief; do not assume an open-source license                          |

The project source has been pushed to GitHub. Follow-up local configuration changes and this document may require a separate commit and push. GitHub hosting of source code is distinct from hosting a working SaaS application.

## Project overview

Trackr centralizes a job seeker's saved opportunities, applications, CVs, notes, and follow-up reminders. It combines a visual application pipeline with AI-assisted preparation: structured CV extraction, CV-to-job match analysis, cover-letter generation, and interview questions.

The application also implements common SaaS concerns such as authentication, account-level data isolation, free/pro usage quotas, subscription billing, administrative reporting, background processing, and operational configuration. Its architecture separates interactive HTTP requests from slower document-processing and AI workloads.

The intended benefit is to help a job seeker organize their search and prepare tailored application material. Actual improvements in hiring outcomes, application speed, or productivity have not been measured.

## Functional scope

### Account access and security

- Email/password registration and login, Argon2 password hashing, and Passport JWT authentication.
- HTTP-only access and refresh cookies, hashed refresh-token storage, token rotation, and logout.
- Google OAuth authorization-code integration with state validation and verified email checks; requires Google credentials.
- User-scoped authorization on jobs, applications, resumes, AI results, notifications, and reminders.
- Separate administrative role guards for account-wide reporting and queue monitoring.
- Shared input validation, Redis-backed rate limits, mutation origin checks, CSRF protection, and security headers.

### Job and application management

- Create, edit, delete, search, sort, and paginate saved jobs.
- Track applications in a drag-and-drop Kanban board and change stages through a detail drawer.
- Associate a CV with an application, maintain notes, and schedule follow-ups.
- Display dashboard totals, charts, pipeline summaries, recent applications, and reminders.
- Support responsive layouts, light/dark themes, and optimistic board updates with rollback on API failure.

### CV processing and AI preparation

- Upload PDF CVs to private S3-compatible storage using time-limited, create-only signed URLs.
- Validate the upload ticket, ownership, file size, content type, and PDF signature before processing.
- Extract text in a background worker, request structured CV information from the Python service, and store embeddings.
- Compare CV and job embeddings using pgvector cosine distance as part of AI-assisted match analysis.
- Generate cover letters with incremental output delivered through Server-Sent Events.
- Generate interview preparation questions and persist AI results for later retrieval.
- Use a provider abstraction supporting OpenAI and AWS Bedrock, with Pydantic validation and a retry for invalid structured output.
- Use 1024-dimensional embeddings by default, aligned with the database schema.

These features use external models; Trackr does not train a proprietary model. Describe the work as AI integration and application engineering, not model training, fine-tuning, or a proven improvement in matching accuracy. PDF extraction does not include OCR for image-only documents.

### Notifications, billing, and administration

- Socket.IO notifications delivered to authenticated user rooms through Redis pub/sub.
- Welcome, reminder, and weekly-summary email templates using React Email, local SMTP/Mailpit, and an optional Resend integration.
- Stripe Checkout and Customer Portal integration, webhook signature verification, and event deduplication.
- Subscription reconciliation against current Stripe state to handle out-of-order events.
- Free/pro monthly AI quotas configured at 10 and 200 accepted tasks, respectively.
- Admin user search, usage totals, signup chart, and an MRR calculation for the configured single monthly price.

The quota values are product configuration, not adoption metrics. The MRR feature does not imply that the project has paying customers or earned revenue.

## Technology stack and responsibilities

| Area                   | Technologies                                                 | Purpose                                                                    |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Frontend               | Next.js App Router, React, TypeScript                        | Routing, pages, interactive workspace                                      |
| UI and forms           | Tailwind CSS, Radix components, React Hook Form, Zod         | Responsive styling, dialogs, validated forms                               |
| Client data            | TanStack Query                                               | Server-state caching, mutations, optimistic updates                        |
| Interaction and charts | dnd-kit, Recharts                                            | Kanban interaction and dashboard visualization                             |
| Backend                | NestJS, Passport, OpenAPI/Swagger                            | Modular REST API, authentication, API documentation                        |
| Database               | PostgreSQL, pgvector, Drizzle ORM                            | Relational persistence, vector similarity, SQL migrations                  |
| Shared contracts       | Zod and TypeScript workspace package                         | Reusable input schemas and types                                           |
| Asynchronous work      | Redis, BullMQ                                                | Job queues, retries, rate counters, pub/sub, streamed partial output       |
| AI service             | Python, FastAPI, Pydantic, uv                                | Internal AI endpoints, provider access, output validation                  |
| Providers              | OpenAI and AWS Bedrock adapters                              | Text generation, structured extraction, embeddings                         |
| Live updates           | Socket.IO, Server-Sent Events                                | Notifications and incremental cover-letter delivery                        |
| Files                  | MinIO and S3-compatible APIs                                 | Private PDF object storage and signed uploads                              |
| Payments               | Stripe                                                       | Checkout, subscription portal, webhook processing                          |
| Email                  | React Email, SMTP/Mailpit, Resend                            | Email templates and delivery integrations                                  |
| Observability          | Pino, Sentry, OpenTelemetry                                  | Structured logs and optional error/trace exports                           |
| Tests                  | Vitest, Supertest, PGlite/pgvector, Playwright, pytest, Ruff | API, schema, UI, and Python verification                                   |
| Workspace              | pnpm, Turborepo                                              | Dependency management and coordinated tasks                                |
| Operations             | Docker Compose, Caddy, GitHub Actions, Terraform             | Local services, deployment configuration, CI, AWS reference infrastructure |

## Architecture and engineering decisions

### Service boundaries

The browser communicates with the NestJS API using REST and cookie authentication. PostgreSQL holds durable application data. Redis supports queues and transient coordination. A separate worker handles document parsing, AI requests, scheduled notifications, and email. The FastAPI service exposes internal, shared-key-protected AI endpoints and does not access the database directly.

Next.js route protection checks cookie presence for navigation; the API performs the actual authentication and authorization. This prevents frontend routing from becoming the sole security boundary.

### Transactional application updates

Board movements lock the current user's database row and reorder affected columns in a transaction. The frontend updates optimistically and rolls back if persistence fails. This is a concrete consistency mechanism rather than evidence of measured high-scale throughput.

### Concurrency-safe AI admission

AI requests lock the user row, check the current subscription plan and monthly usage, reserve a credit, and persist a pending result in one transaction. This prevents simultaneous requests from exceeding the remaining quota. A worker sweep recovers pending results if immediate enqueueing fails. Accepted requests consume a credit even if the external provider ultimately fails.

### Streaming and recovery

Cover-letter generation runs in the worker. Partial output is stored temporarily in Redis, exposed through SSE, and finalized in PostgreSQL. Reading or reconnecting to the stream does not create another paid generation request. The UI can retrieve the saved result after completion.

### Idempotency and failure handling

Background jobs use retries with exponential backoff and stable job IDs. Notifications use unique event keys. Stripe events are deduplicated in a transaction, with reconciliation against current subscription state. These mechanisms reduce duplicate effects; they do not provide an unlimited exactly-once guarantee for external email delivery.

### Infrastructure configuration

The repository includes development and production Docker configurations, Caddy reverse-proxy configuration, GitHub Actions workflows, backup/deployment scripts, and Terraform modules for AWS networking, data, and compute. The AWS reference includes ECS/Fargate, RDS, Redis, S3, an application load balancer, service discovery, logging, and secret access controls. These are authored configurations, not a verified live AWS deployment.

## Repository structure

```text
apps/web/                  Next.js UI, client data hooks, browser tests
apps/api/                  NestJS REST API and background worker
apps/api/src/db/            Drizzle schema, migration runner, seed logic
apps/api/drizzle/           Generated SQL migration and metadata
services/ai/               FastAPI service, models, provider adapters, prompts, tests
packages/shared/           Shared Zod schemas and TypeScript types
packages/config/           Shared development configuration
infra/terraform/           AWS infrastructure modules and mocked-provider test
infra/caddy/               Reverse-proxy configuration
infra/scripts/             Deployment and backup scripts
.github/workflows/         CI and deployment workflows
docs/                      Architecture, setup, validation, deployment, project brief
```

## Verified results and limits

| Evidence                    | Verified scope                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint and TypeScript checks  | Passed in the local environment                                                                                                                               |
| JavaScript/TypeScript tests | 15 passed: 11 API, 3 shared-schema, 1 frontend utility                                                                                                        |
| Python checks               | 4 pytest tests and Ruff checks passed                                                                                                                         |
| Browser tests               | 2 Chromium tests passed, including fixture-backed private pages and 375px mobile layouts; 1 live-stack journey was skipped                                    |
| Database setup              | Dedicated Docker pgvector database started on host port 55432; real migrations and demo seeding succeeded                                                     |
| API readiness               | Health endpoint reported PostgreSQL and Redis as healthy                                                                                                      |
| Local authentication        | Demo-account login succeeded through the actual HTTP API                                                                                                      |
| Terraform                   | Validation and 1 mocked-provider plan test passed under WSL                                                                                                   |
| Production builds           | Earlier builds succeeded; the latest Windows run failed during Next.js standalone packaging with an ENOENT filesystem error after compilation/page generation |
| GitHub                      | Initial project source was successfully pushed to the repository                                                                                              |

API integration tests use PGlite with pgvector locally and mock queue, storage, and external payment calls. Python tests use fake AI providers. Fixture-based browser tests do not establish live external integration behavior. No performance benchmark, load-test result, real payment, verified production email delivery, live cloud deployment, or measured user adoption is available in this brief. A GitHub Actions workflow being present does not prove that its remote runs are passing.

## CV-ready wording options

These are editable examples. Use only bullets that match the candidate's confirmed involvement and ability to explain the implementation.

### One-line project description

**Trackr — AI-powered job application tracker:** A full-stack portfolio application combining job tracking, a Kanban pipeline, PDF CV processing, AI-assisted preparation, and subscription workflows using Next.js, NestJS, PostgreSQL, Redis, and FastAPI.

### Concise project entry

**Trackr | Full-Stack Portfolio Project**  
**Repository:** https://github.com/Dilanka-Bandara/trackr  
**Stack:** TypeScript, Next.js, NestJS, PostgreSQL/pgvector, Redis/BullMQ, Python/FastAPI, Docker

- Developed a job-tracking workspace with a responsive dashboard, Kanban application pipeline, CV management, and follow-up reminders.
- Implemented background AI workflows for structured CV parsing, vector-assisted job matching, streamed cover letters, and interview preparation through a separate FastAPI service.
- Added user-scoped authorization, rotating refresh tokens, transactional AI quotas, and Stripe webhook deduplication to support SaaS account and billing workflows.
- Verified behavior with 15 TypeScript tests, 4 Python tests, and 2 browser tests, using test doubles for external services.

### Alternative bullets for backend-oriented applications

- Designed modular NestJS APIs with shared Zod contracts, Drizzle migrations, PostgreSQL persistence, and ownership checks across user-managed resources.
- Used row locks and database transactions to keep Kanban ordering and concurrent AI quota reservations consistent.
- Separated slow AI and document-processing tasks from HTTP requests with BullMQ workers, retries, durable pending records, and Redis-backed progress delivery.

### Alternative bullets for frontend-oriented applications

- Built a responsive Next.js workspace with validated forms, searchable job lists, application detail dialogs, charts, and light/dark themes.
- Implemented optimistic Kanban mutations with rollback using TanStack Query and drag-and-drop interaction using dnd-kit.
- Connected the UI to live notifications and streamed generation results using Socket.IO and Server-Sent Events.

### Alternative bullets for infrastructure-oriented applications

- Authored Docker Compose environments, Caddy configuration, deployment/backup scripts, and GitHub Actions workflows for the application.
- Defined an AWS reference architecture with Terraform modules and validated it with a mocked-provider plan test; no live deployment claimed.

Do not include every alternative in one CV. Select three or four strong bullets appropriate to the target role, and avoid listing configured integrations as verified operational achievements.

## Interview discussion topics

- Why AI and parsing run outside the HTTP API process.
- How API ownership checks differ from frontend route protection.
- How transaction locking prevents concurrent quota overspending.
- How a pending-result record supports recovery when queue submission fails.
- How SSE and Socket.IO serve different interaction needs.
- How signed uploads, upload tickets, and file checks protect private CV storage.
- Why webhook signatures, event deduplication, and latest-state reconciliation are separate concerns.
- What fixture tests prove, and which live integrations remain to be verified.
- How a PostgreSQL port/credential mismatch was diagnosed and resolved using a dedicated local container.

## Instructions for the CV-writing LLM

1. Treat Trackr as a portfolio project unless the candidate supplies evidence of employment or client work.
2. Confirm the candidate's individual contributions, project dates, and target role before finalizing personal achievement claims.
3. Use concrete mechanisms and technologies rather than unsupported adjectives such as enterprise-grade, highly scalable, or production-ready.
4. Do not invent percentages, revenue, user counts, accuracy metrics, latency improvements, or time savings.
5. Use verified test counts only when helpful; do not translate them into a coverage percentage.
6. Preserve the difference between implemented integrations, mocked tests, and real externally verified behavior.
7. Include the exact repository link. Do not invent a live demo link.
8. Do not claim custom model training, fine-tuning, production AWS deployment, or successful CI runs without new evidence.
9. Keep the final CV entry concise and suited to the target role. This document is supporting context, not text to paste wholesale into a CV.
10. Request missing information rather than writing fictional learning reflections or personal history.

## Further evidence in the repository

- [Project README](../README.md)
- [Architecture and engineering tradeoffs](architecture.md)
- [Technical stack](TECH_STACK.md)
- [Validation record](VALIDATION.md)
- [Setup and integrations](setup.md)
- [Deployment guide](deploy.md)
- [AWS Terraform documentation](../infra/terraform/README.md)

Use the latest execution results when documentation and historical validation notes differ. This brief records the latest known Windows packaging failure and the subsequent successful real database setup so that a downstream writer does not mistake older status notes for current proof.
