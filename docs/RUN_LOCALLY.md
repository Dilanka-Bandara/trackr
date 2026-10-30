# Trackr: how to run locally on your Windows computer

This guide is for your existing setup at:

```text
E:\New Projects\Trackr an AI-powered job application tracker (SaaS)
```

Use **PowerShell**. Copy only the commands inside each code block, without any `PS ...>` prompt. Your configuration, database, demo account, and AI models are already installed. You do not need to reinstall or download them every time.

## 1. Open Docker Desktop and Ollama

1. Open **Docker Desktop** from the Start menu. Wait until its engine is running.
2. Open **Ollama** from the Start menu. It may run in the system tray without opening a window.
3. Open PowerShell and check:

```powershell
docker info --format '{{.ServerVersion}}'
ollama list
Get-Service Memurai
```

Expected results:

- Docker prints a version without a connection error.
- Ollama lists `qwen2.5:7b` and `qwen3-embedding:0.6b`.
- Memurai has status `Running`. Memurai supplies the Redis-compatible service used by Trackr on port 6379.

If Memurai is stopped, open a separate PowerShell window **as Administrator**, run the following, and then return to your normal terminal:

```powershell
Start-Service Memurai
```

Do not start Docker's Redis service alongside Memurai: both would try to use port 6379.

## 2. Start the database, CV storage, and email inbox

In your first PowerShell terminal:

```powershell
Set-Location 'E:\New Projects\Trackr an AI-powered job application tracker (SaaS)'
docker compose -f docker-compose.yml -f compose.local-storage.yaml up -d postgres minio mailpit
docker compose -f docker-compose.yml -f compose.local-storage.yaml ps
```

Wait until PostgreSQL and MinIO show `healthy`. If they show `health: starting`, wait a few seconds and run the `ps` command again.

Then run:

```powershell
node infra/scripts/init-local-storage.cjs
pnpm.cmd db:migrate
```

The first command should print `Local private CV bucket is ready.` It is safe to run again; it preserves the existing bucket. The migration command applies any pending database changes and preserves existing application data.

Use the complete Compose commands above. This setup uses a locally built MinIO image because the original image downloads were unavailable.

## 3. Start the AI service — terminal 1

In the same terminal:

```powershell
Set-Location 'E:\New Projects\Trackr an AI-powered job application tracker (SaaS)\services\ai'
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Wait for `Application startup complete` and the address `http://127.0.0.1:8000`.

**Leave this terminal open.** The command keeps running while the AI service is available.

## 4. Start the website, API, and worker — terminal 2

Open a **second PowerShell terminal** and run:

```powershell
Set-Location 'E:\New Projects\Trackr an AI-powered job application tracker (SaaS)'
pnpm.cmd dev
```

This single command starts the website, API, and background worker. Wait for the website to report `Ready` and the worker to report `Trackr worker ready`.

**Leave this terminal open too.** Do not run another copy of `pnpm.cmd dev` while it is already running.

## 5. Open Trackr

Open [http://localhost:3000](http://localhost:3000) in your browser.

Use the existing demo account:

| Field    | Value             |
| -------- | ----------------- |
| Email    | `demo@trackr.dev` |
| Password | `Demo1234!`       |

You can also register your own account. The demo opportunities are illustrative examples.

### Try the AI features

1. Open **My CVs** and upload a short PDF with selectable text, up to 5 MB. Scanned image-only PDFs are not supported.
2. Wait for **Ready to use**.
3. Add an application with its job title, company, and a useful job description.
4. Open that application on the board and choose your PDF under **Your CV**.
5. Open **AI match** and click **Analyze my match**.
6. Try **Cover letter → Draft cover letter** and **Interview → Prepare for interview**.

Allow time for each result before starting another. Local AI uses your computer's resources, and the first request can take longer while a model loads. Generation uses the app's AI credits even though Ollama has no paid provider API key. Review generated content before using it.

## 6. Check whether everything is running

In an optional third PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

The API should report `status`, `postgres`, and `redis` as `ok`. The AI service should report `status: ok`. Ollama should return its installed models. Health checks confirm services are reachable; an actual AI action confirms inference works.

| Service            | Address                          |
| ------------------ | -------------------------------- |
| Trackr website     | http://localhost:3000            |
| API health         | http://localhost:4000/api/health |
| API documentation  | http://localhost:4000/api/docs   |
| AI service health  | http://127.0.0.1:8000/health     |
| Local email inbox  | http://localhost:8025            |
| CV storage console | http://localhost:9001            |

Development emails appear in Mailpit at port 8025; they are not delivered to your real inbox.

## 7. Stop Trackr when finished

1. Press **Ctrl+C** in terminal 2 to stop the website, API, and worker.
2. Press **Ctrl+C** in terminal 1 to stop the Python AI service.
3. To stop Trackr's containers, run:

```powershell
Set-Location 'E:\New Projects\Trackr an AI-powered job application tracker (SaaS)'
docker compose -f docker-compose.yml -f compose.local-storage.yaml stop postgres minio mailpit
```

This preserves your database and uploaded files. Do not use `down -v` or delete Docker volumes: that removes stored data.

You can quit Ollama from its system-tray menu when you no longer need it. Leave Memurai running if other projects use it. To start Trackr again, follow steps 1–5.

## Setup commands you only need occasionally

### If the local MinIO image is missing

From the repository root:

```powershell
docker compose -f docker-compose.yml -f compose.local-storage.yaml build minio
```

Then repeat step 2. The first build downloads dependencies and can take several minutes. You do not need to rebuild it on every start.

### After pulling code that changes dependencies

Stop the app and AI service first. From the repository root:

```powershell
pnpm.cmd install --frozen-lockfile
Set-Location services/ai
uv sync --frozen
```

If downloads fail because of certificate verification on this computer, use the system certificate store:

```powershell
# Run this from the repository root for Node dependencies:
$env:NODE_OPTIONS = '--use-system-ca'
pnpm.cmd install --frozen-lockfile

# Run this from services/ai for Python dependencies:
uv --native-tls sync --frozen
```

Then follow the normal startup steps, including `pnpm.cmd db:migrate` from the repository root.

### Only if an Ollama model is missing

```powershell
ollama pull qwen2.5:7b
ollama pull qwen3-embedding:0.6b
```

Both models are already installed on your computer. Keep the same embedding model for existing data; changing models requires re-embedding stored data.

## Troubleshooting

| Problem                                    | What to do                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker cannot connect                      | Open Docker Desktop and wait for its engine to start, then repeat step 2.                                                                                           |
| `pnpm` is not recognized                   | Use `pnpm.cmd`. If that also fails, use `& "$env:APPDATA\npm\pnpm.cmd" dev` from the repository root.                                                               |
| Ollama cannot connect                      | Open Ollama. Alternatively, run `ollama serve` in another terminal and leave it open. If it reports the address is in use, an Ollama server may already be running. |
| Port 3000, 4000, or 8000 is already in use | Check whether Trackr is already running. Reuse that instance or stop its original terminal with Ctrl+C before restarting. Do not terminate unrelated processes.     |
| Database password error                    | Check that the local `.env` still points to port **55432**, not 5432. This computer has another PostgreSQL installation. Preserve the configured username/password. |
| Redis connection error                     | Check `Get-Service Memurai` and start it if stopped.                                                                                                                |
| CV upload fails                            | Check MinIO is healthy and rerun `node infra/scripts/init-local-storage.cjs` from the repository root.                                                              |
| CV stays processing or AI fails            | Check both app terminals for errors, verify Ollama models with `ollama list`, and confirm the AI health endpoint responds.                                          |
| AI is slow                                 | Try one request at a time, use a short text-based PDF, and close other memory-heavy apps.                                                                           |
| Login page opens but sign-in fails         | Check the API health endpoint and the terminal running `pnpm.cmd dev`.                                                                                              |

Your ignored root `.env` already selects Ollama. Do not overwrite it with `.env.example`, publish it to GitHub, or paste its secrets into screenshots. Restart the app and AI service after changing configuration.

This guide starts Trackr on your computer only. Public hosting is a separate step. For provider details and validation evidence, see [LOCAL_AI.md](LOCAL_AI.md) and [VALIDATION.md](VALIDATION.md).
