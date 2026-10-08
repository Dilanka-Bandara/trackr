# Deploying Trackr to a VPS

The repository includes deployment configuration. No server, cloud resources, public site, or GitHub repository has been created automatically.

## Prepare the host

Use a Linux VPS with sufficient memory for PostgreSQL, Redis, API, worker, web, and AI (4 GB minimum for a small demo; measure real usage). Create a dedicated deployment user, install Docker Engine and Compose, and configure SSH keys. Permit only SSH (22), HTTP (80), and HTTPS (443) in the firewall. Do not expose database, Redis, internal AI, or storage admin ports.

Create `/opt/trackr/infra/caddy` and `/opt/trackr/infra/scripts`, owned by the deployment user. Copy `docker-compose.prod.yml`, `infra/caddy/Caddyfile`, deployment/backup scripts, and a private `.env` to the host. Keep `.env` readable only by the deployment user. Docker-group access is effectively root access; protect that account.

Set a DNS A/AAAA record for your domain pointing to the host. Configure `DOMAIN=trackr.example.com`, `WEB_URL=https://trackr.example.com`, `API_URL=https://trackr.example.com`, strong unique database/JWT/internal secrets, production S3/R2 endpoint and bucket, and provider settings. Set `EMAIL_PROVIDER=resend`. Local `localhost` Caddy certificates require trusting Caddy's local CA; an actual public DNS name gets normal automatic HTTPS.

Production storage is external S3/R2. Configure its private bucket and CORS as described in setup.md. Set `REGISTRY=ghcr.io/OWNER/REPO` (lowercase), matching workflow image names `REGISTRY-web`, `REGISTRY-api`, `REGISTRY-ai`. Use an immutable `IMAGE_TAG` commit SHA. Log Docker into GHCR on the host if the images are private.

## GitHub configuration

Push the repository to your GitHub account with `main` as its deployment branch. CI runs checks before publishing images. Create the `production` GitHub Environment and configure protection rules suitable for your project. Add:

- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS` — verify the host key fingerprint through your server console before adding it. The workflow does not silently trust a newly scanned key.

The Deploy workflow runs only after a successful push-to-main CI run, copies the reviewed Compose/proxy/script configuration, pulls images tagged with that exact commit, runs migrations, starts services, and probes the API health endpoint. No secret is written into an image. Build the web with `NEXT_PUBLIC_API_URL=/api` (the Dockerfile default) so Caddy routes API traffic on the same origin.

## Manual deployment

```sh
cd /opt/trackr
IMAGE_TAG=YOUR_COMMIT_SHA bash infra/scripts/deploy.sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 api worker ai
```

Check sign-in, saved jobs, board changes, CV parsing, SSE, email, and Stripe test mode before enabling real payments. Do not run the demo seed in production. Create an initial account and promote it through a controlled administrator procedure after identity verification.

## Backup and restore

Configure AWS CLI credentials through the host role or a protected environment. Run `BACKUP_S3_URI=s3://your-backup-bucket/trackr bash infra/scripts/backup.sh` daily using a systemd timer or your operations scheduler. The script streams a PostgreSQL dump into a temporary gzip archive and uploads it with server-side encryption. Bucket versioning, retention, access controls, monitoring, and restore drills are your operational responsibilities. Back up object storage independently.

To restore, select the correct backup, create a separate empty database, decompress the dump, and import with `psql`. Verify migrations, counts, account ownership, and object keys before switching the production connection. Never overwrite a live database without a reviewed recovery plan.

## Rollback

Read `.deployed-image` or deployment history to identify the previous healthy image SHA. Re-run the deployment script with that SHA. Application rollback does not undo database migrations; migrations must remain backward compatible with the previous application or have a separately reviewed recovery plan. The workflow fails if health checks fail; it does not silently destroy data or run destructive down migrations.
