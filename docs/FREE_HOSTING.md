# Free hosting for the Trackr portfolio demo

Reviewed 30 October 2026. No account, server, domain, or deployment was created during this review. Provider eligibility and quotas must be checked again at signup.

## Recommended route, if eligible

For the existing full-stack architecture, consider an **Oracle Cloud Always Free Ampere VM**. It can run the web application, API, worker, Python service, PostgreSQL, Redis, and reverse proxy together. This is a proposed deployment route, not a verified Oracle deployment of this repository.

Oracle currently documents an A1 allowance equivalent to **2 OCPUs and 12 GB RAM**, with combined boot/block storage allowances. Choose only resources marked Always Free eligible in your home region. Capacity may be unavailable, and idle instances may be reclaimed. Most users need a phone and credit card for account verification; Oracle says the card is not charged unless the account is upgraded. Do not upgrade to a paid account or rely on temporary trial credits for a zero-cost portfolio. [Resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [signup and trial rules](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

If signup or capacity prevents this route, stop before purchasing anything. A frontend-only interactive showcase is another possible portfolio scope, but would require a clearly labeled demo mode; it would not be the complete live backend.

## Why not simply deploy everything to Render Free?

Render Free web services sleep after 15 minutes without inbound traffic and share 750 running hours per workspace each month. Background workers are not a free service type, and its free PostgreSQL database expires after 30 days. Trackr depends on persistent queues and a worker for CV parsing, AI, and reminders. The repository cannot be deployed unchanged as a fully functioning, reliably available free Render stack. [Render free-tier documentation](https://render.com/docs/free).

## 1. Confirm the free account and hostname

Create an Oracle Free Tier account and check whether an Always Free A1 instance is available. Choose an eligible Ubuntu ARM64 image. Keep total resources within the console's free allowance, including other VMs on the same account. Save the SSH private key locally; never commit it.

You do not need to buy a domain for a portfolio. DuckDNS provides a free subdomain pointing at an IP you select, for example `your-trackr-demo.duckdns.org`. Point it at the VM's public address and update it if that address changes. [DuckDNS description](https://www.duckdns.org/about.jsp).

Allow inbound TCP 80 and 443 for the website, and restrict SSH port 22 to your own IP where practical. Apply the rules in both the cloud network and host firewall. Keep PostgreSQL, Redis, the Python service, and storage administration private. Caddy uses the hostname and reachable ports to serve the site over HTTPS.

## 2. Prepare Linux and get the source

Install Docker Engine and the Docker Compose plugin using the [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Use a deployment account and protect its SSH credentials. Docker access grants powerful host privileges.

On the VM:

```sh
git clone https://github.com/Dilanka-Bandara/trackr.git
cd trackr
cp .env.example .env
chmod 600 .env
```

First commit and push any intended local changes from your development machine. The server only receives committed remote source. Keep `.env` excluded.

## 3. Configure a separate production environment

Edit the VM's `.env`, not your laptop's local-development environment. Use the values below as a checklist, replacing placeholders:

```dotenv
NODE_ENV=production
DOMAIN=your-trackr-demo.duckdns.org
WEB_URL=https://your-trackr-demo.duckdns.org
API_URL=https://your-trackr-demo.duckdns.org
NEXT_PUBLIC_API_URL=/api
TRUST_PROXY_HOPS=1
PORT=4000
POSTGRES_USER=trackr
POSTGRES_DB=trackr
POSTGRES_PASSWORD=GENERATE_A_NEW_HEX_SECRET
JWT_SECRET=GENERATE_A_DIFFERENT_HEX_SECRET
AI_INTERNAL_KEY=GENERATE_ANOTHER_HEX_SECRET
REGISTRY=trackr-local
```

Generate each secret separately with `openssl rand -hex 32`. A hexadecimal database password avoids connection-URL escaping problems in the current Compose template. Never use the development secrets or demo-account password on a public instance.

Production Compose supplies the internal database, Redis, and AI addresses. Keep the API's internal port at 4000 because Caddy and health checks use it. Build the frontend with `/api` so authentication stays on the same public origin.

### CV object storage

The production Compose file expects an external private S3-compatible bucket. Oracle Object Storage exposes an S3 compatibility API and customer-secret access keys. A candidate configuration is:

```dotenv
S3_ENDPOINT=https://YOUR_NAMESPACE.compat.objectstorage.YOUR_REGION.oraclecloud.com
S3_PUBLIC_ENDPOINT=https://YOUR_NAMESPACE.compat.objectstorage.YOUR_REGION.oraclecloud.com
S3_REGION=YOUR_REGION
S3_BUCKET=trackr-uploads
S3_ACCESS_KEY=YOUR_CUSTOMER_ACCESS_KEY
S3_SECRET_KEY=YOUR_CUSTOMER_SECRET_KEY
```

Use least-privilege bucket access and the exact HTTPS website origin for CORS. Permit PUT/HEAD and the headers used by Trackr's signed uploads, including `Content-Type`, `If-None-Match`, and applicable `x-amz-*` headers. Trackr's particular signed PUT and create-only conditional-write behavior has **not** been tested against Oracle. Verify upload, duplicate-upload rejection, confirmation, and deletion before claiming CV support works. Do not remove overwrite protection to make an incompatible storage backend appear functional. [S3 compatibility](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi_topic-Amazon_S3_Compatibility_API_Support.htm), [customer secret keys](https://docs.oracle.com/en-us/iaas/Content/Identity/access/working-with-customer-secret-keys.htm).

### AI, payments, and email

Free hosting does not supply free OpenAI or Bedrock inference. For a strictly zero-spend deployment, leave those credentials empty and state that AI generation is unavailable in the public demo. Existing code returns provider failures rather than fabricated successful AI results. A polished limited demo should disable those controls or label them before sharing broadly; that UI mode is not implemented by this guide.

Leave Stripe keys empty for a portfolio that does not sell subscriptions. Google sign-in is optional; email/password login can be used independently.

For a zero-delivery-cost demonstration, capture emails privately instead of sending them. Set `EMAIL_PROVIDER=smtp`, `SMTP_HOST=mailpit`, and `SMTP_PORT=1025` in the server `.env`. Create a local `compose.demo-mail.yml` with:

```yaml
services:
  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    mem_limit: 128m
```

Do not publish Mailpit ports. Reminders are captured for testing and will not reach real inboxes. For actual delivery, configure a provider account, verified sender, and its current free allowance separately.

## 4. Build images for the VM architecture

Ampere A1 uses ARM64. The current GitHub image workflow uses the runner's default architecture; do not assume those images support ARM64. Initially build on the VM itself, or add and verify ARM64 publishing before using GHCR images.

From the repository root on the VM:

```sh
export IMAGE_TAG=$(git rev-parse HEAD)
export REGISTRY=trackr-local
docker build --target production -f apps/api/Dockerfile -t "$REGISTRY-api:$IMAGE_TAG" .
docker build --target production --build-arg NEXT_PUBLIC_API_URL=/api -f apps/web/Dockerfile -t "$REGISTRY-web:$IMAGE_TAG" .
docker build --target production -f services/ai/Dockerfile -t "$REGISTRY-ai:$IMAGE_TAG" services/ai
```

These Linux ARM64 builds still need to be executed and verified. Stop if any image fails to build. The latest Windows frontend build compiled successfully but failed during standalone packaging with a filesystem permission error; this is not proof that the Linux container build succeeds.

## 5. Migrate and start

Use the same shell with the exported image tag. If using the private mail-capture configuration:

```sh
docker compose -f docker-compose.prod.yml -f compose.demo-mail.yml config --quiet
docker compose -f docker-compose.prod.yml -f compose.demo-mail.yml up -d --wait postgres redis ai mailpit
docker compose -f docker-compose.prod.yml -f compose.demo-mail.yml run --rm migrate
docker compose -f docker-compose.prod.yml -f compose.demo-mail.yml up -d
docker compose -f docker-compose.prod.yml -f compose.demo-mail.yml ps
```

The existing deployment script pulls registry images, so do not use it for these locally built `trackr-local` images. Record the successful `IMAGE_TAG` for later restarts and updates. Do not run the development seed against production.

Check `https://YOUR_HOSTNAME/api/health`, then open the website and create your own account. Test sign-in, job creation, board updates, profile editing, password changes, and persistence across a container restart. Test storage and AI separately only when configured. Review API/worker logs if an operation fails.

## 6. Before adding the URL to your CV

- Confirm the public HTTPS URL works from another device and an incognito browser.
- Document demo limitations honestly, especially AI availability and captured-only emails.
- Keep secrets and personal CVs out of the repository and demo data.
- Back up PostgreSQL and uploaded files outside the VM; an idle free VM can be reclaimed.
- Recheck quotas and the account cost estimate; do not assume trial credits are an ongoing free allowance.
- Retain the repository link even if a free demo becomes temporarily unavailable.

The next decision is whether Oracle's signup requirements and free capacity work for you. No payment method, account credential, or secret key should be pasted into chat. If that route is unavailable, adapt the portfolio scope before choosing a different free platform.
