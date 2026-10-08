#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${BACKUP_S3_URI:?Set BACKUP_S3_URI to an s3://bucket/prefix destination}"
archive="trackr-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
temp_dir="$(mktemp -d)"
trap 'rm -f "$temp_dir/$archive"; rmdir "$temp_dir"' EXIT
docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$temp_dir/$archive"
aws s3 cp "$temp_dir/$archive" "${BACKUP_S3_URI%/}/$archive" --sse AES256
echo "Backup uploaded: $archive"
