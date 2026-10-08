# Technical stack

| Layer                 | Implementation                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Workspace             | pnpm 11.19 + Turborepo                                                                                                              |
| Web                   | Next.js 16 App Router, React, Tailwind 4, Radix/shadcn-style Button/Dialog, TanStack Query, React Hook Form, Zod, dnd-kit, Recharts |
| API                   | NestJS 12, Passport JWT, OpenAPI, Pino, Argon2                                                                                      |
| Data                  | PostgreSQL 16, pgvector, Drizzle                                                                                                    |
| Async                 | Redis, BullMQ, separate worker process, Socket.IO, SSE                                                                              |
| AI                    | Python 3.12, uv, FastAPI, Pydantic, OpenAI and Bedrock adapters                                                                     |
| Storage/email/payment | MinIO/S3, Mailpit/Resend/React Email, Stripe                                                                                        |
| Verification          | Vitest, Supertest, PGlite+pgvector local tests, PostgreSQL CI tests, Playwright, pytest, Ruff                                       |
| Operations            | Docker Compose, Caddy, GitHub Actions, Terraform AWS, optional Sentry/OpenTelemetry                                                 |

Package versions were resolved from the registry and captured in `pnpm-lock.yaml` and `services/ai/uv.lock`. The lockfiles are authoritative. pnpm's release-age policy may resolve a slightly older stable release than a registry `latest` query.

TypeScript 7 supplies `tsc` through the `@typescript/native` npm alias. Next.js and typescript-eslint still require the JavaScript compiler API, so `typescript` aliases the official `@typescript/typescript6` compatibility package. This follows [TypeScript's documented side-by-side arrangement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

Next.js 16 calls its request middleware convention `proxy.ts`. The file performs a quick cookie-presence redirect; every actual authorization decision remains in the API. See the [official Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication).

The data model uses the brief's tables plus a unique `notifications.event_key` for notification deduplication. One application per user/job avoids accidental duplicate cards. Vector dimensions default to 1024; changing dimensions requires a reviewed migration and compatible provider configuration.

Google's authorization-code exchange is implemented directly with state cookies and verified-userinfo validation. Passport handles JWT authentication. Rate limiting uses an atomic Redis increment/expiry guard, allowing both processes to share counters without a separate storage adapter dependency.
