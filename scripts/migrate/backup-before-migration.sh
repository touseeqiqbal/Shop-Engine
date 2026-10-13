#!/usr/bin/env bash
# Full logical backup of the whole database (all schemas) BEFORE any Payload migration step.
#
#   DATABASE_URL=postgresql://…public-url… bash scripts/migrate/backup-before-migration.sh
#
# Writes backups/pre-payload-<timestamp>.dump (custom format, compressed) and verifies it.
# Restore (into an EMPTY database):  pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backups/pre-payload-….dump
# Optionally also uploads it to the bucket when S3_* variables are set (same layout as the daily backup job).
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (use the Postgres PUBLIC url when running from your computer)}"
command -v pg_dump >/dev/null || { echo "pg_dump not found – install PostgreSQL client tools (v17)"; exit 1; }

mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="backups/pre-payload-${stamp}.dump"

echo "→ Dumping database to ${file} …"
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="${file}" "${DATABASE_URL}"

echo "→ Verifying archive …"
tables="$(pg_restore --list "${file}" | grep -c ' TABLE ' || true)"
size="$(wc -c < "${file}")"
[ "${size}" -gt 1024 ] || { echo "Backup looks empty (${size} bytes) – aborting"; exit 1; }
echo "   ${tables} table entries, ${size} bytes"

if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null; then
  echo "→ Uploading to s3://${S3_BUCKET}/backups/ …"
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" AWS_DEFAULT_REGION="${S3_REGION:-auto}" \
    aws s3 cp "${file}" "s3://${S3_BUCKET}/backups/$(basename "${file}")" --endpoint-url "${S3_ENDPOINT}"
fi

echo "✓ Backup complete: ${file}"
echo "  Keep this file until the Payload cutover is confirmed."
