# Local AI for Trackr

Trackr's AI workflows are implemented through a Python FastAPI service called by the NestJS background worker. The service supports OpenAI, Bedrock, and now **Ollama**. Local Ollama inference does not require a paid provider API key. It uses your computer's RAM/CPU/GPU and electricity; it does not provide free cloud hosting.

## Implemented capabilities

| Feature               | Processing                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| CV parsing            | Worker extracts PDF text; model returns validated skills, experience, and education         |
| Embeddings            | Local embedding model returns vectors checked against the configured database dimensions    |
| Match analysis        | Worker combines vector similarity with model-generated strengths, gaps, and a bounded score |
| Cover letters         | Model streams text through FastAPI, worker, Redis, and the authenticated SSE endpoint       |
| Interview preparation | Model returns structured questions, categories, and preparation tips                        |

The API and UI already call these workflows. Selecting Ollama changes the inference provider; it does not bypass ownership checks, queues, or AI quotas. External provider fallback is never automatic.

## Model preparation

On 30 October 2026, local activation was requested. The existing `qwen2.5:7b` model was retained, `qwen3-embedding:0.6b` was downloaded, and the local `.env` was switched to Ollama. Both embedding columns were empty before the switch. A real embedding request returned 1024 dimensions.

When ready to activate local AI, run:

```powershell
ollama list
# Only download the text model if it is missing:
ollama pull qwen2.5:7b
# Separate embedding model required for CV processing and matching:
ollama pull qwen3-embedding:0.6b
```

The text model and embedding model have different jobs. Installing only a chat model is insufficient for the CV-to-match workflow. Review model licenses and hardware requirements before deployment. The embedding-model download is approximately 639 MB according to its current [Ollama listing](https://ollama.com/library/qwen3-embedding:0.6b). Installed size and runtime memory are different quantities.

Start the Ollama application. If it is not already serving requests, `ollama serve` starts its local server. An address-in-use error may mean the desktop application is already running it.

## Environment configuration

When ready, edit the repository-root `.env`:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b
OLLAMA_TIMEOUT_SECONDS=120
EMBEDDING_DIM=1024
```

Keep `AI_INTERNAL_KEY` configured and identical for the API worker and Python service. It protects the internal service; it is not a paid-provider credential. OpenAI and AWS keys are not used by the Ollama adapter. Keep Ollama bound locally and do not expose port 11434 publicly.

If FastAPI runs in Docker Desktop while Ollama runs on Windows, use `OLLAMA_BASE_URL=http://host.docker.internal:11434` instead. Host firewall and Ollama listening configuration must permit that connection; do not globally expose the service to work around connection problems. Running FastAPI on the host is simpler for initial local testing.

## Start Trackr

### This Windows computer

Docker Desktop and Ollama must be running. The existing local Redis service uses port 6379; PostgreSQL uses 55432 to avoid another PostgreSQL installation. Do not start a second Redis on the same port.

The original `minio/minio` and `minio/mc` image downloads were unavailable during activation. An optional local override builds the [archived upstream source](https://github.com/minio/minio) at a pinned revision. This is a local development workaround, not a production storage recommendation. From the repository root:

```powershell
docker compose -f docker-compose.yml -f compose.local-storage.yaml build minio
docker compose -f docker-compose.yml -f compose.local-storage.yaml up -d postgres minio mailpit
# Wait until MinIO is healthy before initializing its private bucket:
node infra/scripts/init-local-storage.cjs
pnpm.cmd db:migrate
pnpm.cmd dev
```

The first source build downloads its compiler and dependencies. Subsequent starts reuse the built image. Start only the named services in this override; its host initialization script replaces `minio-init`. Existing data volumes are preserved. The initialization script refuses non-local storage endpoints and never enables public bucket access.

In a second terminal, start the AI service as shown below. Open `http://localhost:3000` and use the existing demo account `demo@trackr.dev` / `Demo1234!`, or register your own account. The demo account was seeded previously; reseeding is unnecessary.

### General development setup

Keep the normal PostgreSQL, Redis, storage, API, frontend, and worker processes running. If using host development, `pnpm dev` starts web/API/worker; do not launch duplicates of already-running services. In a separate terminal:

```powershell
cd services/ai
uv sync --frozen
uv run uvicorn app.main:app --reload --port 8000
```

On this Windows setup, package downloads may require `uv --native-tls sync --frozen` to use the system certificate store. Restart FastAPI after changing provider/model settings; its settings are cached.

For an initial walkthrough, use a short text-based PDF, create a job with a short description, wait for CV processing to complete, select the CV in the application drawer, then request a match, cover letter, and interview questions. Scanned images require OCR elsewhere; Trackr does not implement OCR.

## Embedding compatibility

Keep `EMBEDDING_DIM=1024` for the existing schema. Do not pad or truncate a model's vectors to make them fit. The service rejects mismatched dimensions or non-finite values.

Vectors from different embedding models are not comparable even when their dimensions match. Use an isolated fresh development database when testing a new embedding provider, or plan a full re-embedding of existing jobs and resumes before changing a populated installation. Automated migration between embedding models is not implemented. Do not mix old OpenAI/Bedrock vectors with new Ollama vectors and trust the resulting scores.

The adapter uses `truncate=false` for embeddings so overly long inputs fail rather than silently losing part of a CV or job. Model context limits and local memory may be lower than the API's input-size limits. Shorten the input or use a model with a suitable context window if this happens. Chat quality and factual accuracy require human review, especially for smaller local models.

## Failure behavior

- Missing models produce a clear local-provider error; pull the exact configured model tag.
- An unreachable server produces a connection error; check Ollama and the base URL.
- Structured responses are validated with Pydantic and retried once if their JSON is invalid.
- Connection/model errors are detected before sending successful cover-letter stream headers.
- A stream that ends without Ollama's completion marker is rejected rather than saved as a completed answer.
- Slow inference can exceed the worker's three-minute request timeout. The per-operation Ollama timeout defaults to 120 seconds; increasing it cannot remove the overall worker deadline.
- Failed accepted AI jobs may consume a credit under the existing quota policy. Failed output is not replaced with fabricated results.

## Testing and proof

`uv run pytest` runs deterministic tests with fake providers and mocked HTTP transports. These cover local JSON mode, request mapping, streamed chunks, incomplete streams, connection failures, missing models, malformed responses, and embedding dimensions without network calls. `uv run ruff check app tests` checks Python style.

A real synthetic-text smoke test is separate from those tests. Its result is recorded in `VALIDATION.md`; mocked tests alone do not prove model quality or the complete PDF/queue/browser workflow. `/health` reports service liveness, not proof that models are installed or that inference succeeds.

## Later free-AI choices

1. **Local Ollama:** Best fit for testing on this computer with the installed models; no per-request provider charge, but the computer must be on.
2. **A self-hosted model on a free VM:** Requires an available VM with sufficient memory and performance. The previously discussed 1–2 OCPU Oracle server has not been benchmarked for these models; do not assume it will provide usable inference latency.
3. **A hosted provider's free allowance:** Evaluate its current quota, privacy terms, available chat/embedding models, and payment requirements before adding an adapter. No such free allowance is assumed or activated here.

Official API references: [Ollama chat and streaming](https://docs.ollama.com/api/chat), [Ollama embeddings](https://docs.ollama.com/api/embed).
