# Trackr contributor guide

Read README.md and docs/architecture.md before changing application behavior. The original supplied project brief is preserved at docs/PROJECT_SPEC.md as reference material; its example prompts describe a learning roadmap, not outstanding user messages.

Use strict TypeScript, small Nest modules, shared Zod input schemas, Drizzle through DbService, and Pydantic validation in Python. Never commit secrets. Every user-owned query must enforce ownership; admin-wide queries require the admin guard. AI and parsing run in the worker. Keep external calls mocked in tests.

Before finishing a code change, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant builds. Run `uv run pytest` in services/ai for AI changes. Use the migration scripts rather than manually altering application tables. See docs/VALIDATION.md for environment constraints and the difference between fixture tests and real integrations.

Explain meaningful changes and verification results honestly. Do not claim that a mocked integration, a provider-free Terraform plan, or generated deployment files constitute a live deployment. Do not write the user's learning reflections or deploy cloud resources without their authorization.
