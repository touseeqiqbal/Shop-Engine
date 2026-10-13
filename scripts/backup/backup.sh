#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily backup (Railway cron service, 02:00 Pakistan time).
#
#   1. Database:  pg_dump $DATABASE_URL | gzip  →  <backup bucket>/backups/YYYY-MM-DD.sql.gz(.enc)
#   2. Private uploads (payment screenshots, return / warranty / trade-in photos, reviews waiting for approval):
#                 every day one archive  →  <backup bucket>/backups-private/YYYY-MM-DD.tar.gz(.enc)
#   3. Photos:    once a week (Sundays, or every day with BACKUP_MEDIA_DAILY=true) the shop's public photos
#                 are copied to <backup bucket>/backups-media/ – so a lost bucket doesn't lose them.
#   4. Old database / private backups (> BACKUP_RETENTION_DAYS, default 30) are deleted.
#   5. Success pings BACKUP_HEARTBEAT_URL (e.g. healthchecks.io) – that service alerts when a night is MISSED.
#      If anything fails, the team is told (email via SMTP or Resend, and/or ALERT_WEBHOOK_URL).
#
# Encryption: set BACKUP_ENCRYPTION_KEY (a long random passphrase, kept OUTSIDE Railway too – e.g. a password
# manager) and the database dump and private archive are encrypted (AES-256, openssl). Without the passphrase they
# can't be restored, so store it safely. Public photos are not encrypted (they are on the website anyway).
#
# The website's bucket:        S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (+ S3_REGION, S3_FORCE_PATH_STYLE)
# Separate backup bucket/keys: BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY
#   (recommended: another bucket – ideally another account – so a leaked website key or a deleted bucket can't
#    take the backups too; without them the website's bucket is used.)
# Alerts: ALERT_EMAILS + (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS | RESEND_API_KEY) + ALERT_FROM, ALERT_WEBHOOK_URL
# Other:  BACKUP_PREFIX (default "backups"), BACKUP_MEDIA (set "false" to skip photos), BACKUP_HEARTBEAT_URL,
#         BACKUP_ENCRYPTION_KEY
#
# Restore: see docs/BACKUP-RESTORE.md
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"

DEST_ENDPOINT="${BACKUP_S3_ENDPOINT:-$S3_ENDPOINT}"
DEST_BUCKET="${BACKUP_S3_BUCKET:-$S3_BUCKET}"
DEST_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-$S3_ACCESS_KEY_ID}"
DEST_SECRET="${BACKUP_S3_SECRET_ACCESS_KEY:-$S3_SECRET_ACCESS_KEY}"

PREFIX="${BACKUP_PREFIX:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
# Named by the date in Pakistan (a 02:00 PKT backup is "today", not yesterday's UTC date)
DATE="$(TZ=Asia/Karachi date +%Y-%m-%d)"
ENC=""; [ -n "${BACKUP_ENCRYPTION_KEY:-}" ] && ENC=".enc"
KEY="${PREFIX}/${DATE}.sql.gz${ENC}"
FILE="/tmp/${DATE}.sql.gz"
# folders with customers' private uploads (src/lib/uploads.ts, checkout) and the public photo folders (src/lib/media.ts)
PRIVATE_FOLDERS="payments returns warranty tradein reviews-pending"
PUBLIC_FOLDERS="media products banners blog reviews"

# encrypts the file when a passphrase is set (adds .enc, removes the plain file); prints the resulting path
encrypt() {
  if [ -z "$ENC" ]; then echo "$1"; return; fi
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$1" -out "$1.enc" -pass env:BACKUP_ENCRYPTION_KEY
  rm -f "$1"
  echo "$1.enc"
}

export AWS_DEFAULT_REGION="${S3_REGION:-auto}"
# Newer aws-cli versions send CRC checksums that some S3-compatible stores reject.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
if [ "${S3_FORCE_PATH_STYLE:-false}" = "true" ]; then
  aws configure set default.s3.addressing_style path
fi
# s3_dest / s3_src: the backup bucket and the website bucket (possibly different accounts)
s3_dest() { AWS_ACCESS_KEY_ID="$DEST_KEY_ID" AWS_SECRET_ACCESS_KEY="$DEST_SECRET" aws --endpoint-url "$DEST_ENDPOINT" s3 "$@"; }
s3_src() { AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" aws --endpoint-url "$S3_ENDPOINT" s3 "$@"; }

# ── tell the team when something fails ──
STEP="starting"
alert() {
  local subject="Urko backup FAILED (${DATE})"
  local body="The nightly backup failed at step: ${STEP}. Check Railway → backup service → logs. The previous backups are still there."
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -s -m 15 -X POST -H "Content-Type: application/json" -d "{\"text\":\"${subject}: ${body}\",\"message\":\"${subject}: ${body}\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
  if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then curl -fsS -m 15 --retry 3 "${BACKUP_HEARTBEAT_URL%/}/fail" >/dev/null || true; fi
  [ -n "${ALERT_EMAILS:-}" ] || return 0
  local from="${ALERT_FROM:-${EMAIL_FROM:-Urko Backup <info@urkotechstore.com>}}"
  if [ -n "${SMTP_HOST:-}" ]; then
    local port="${SMTP_PORT:-587}" scheme="smtp" rcpts=()
    [ "$port" = "465" ] || [ "${SMTP_SECURE:-}" = "true" ] && scheme="smtps"
    IFS=',' read -ra list <<<"$ALERT_EMAILS"
    for r in "${list[@]}"; do rcpts+=(--mail-rcpt "$(echo "$r" | xargs)"); done
    printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n' "$from" "$ALERT_EMAILS" "$subject" "$body" >/tmp/alert.txt
    curl -s -m 30 --url "${scheme}://${SMTP_HOST}:${port}" --ssl-reqd --user "${SMTP_USER:-}:${SMTP_PASS:-}" \
      --mail-from "$(echo "$from" | sed -E 's/.*<([^>]+)>.*/\1/')" "${rcpts[@]}" --upload-file /tmp/alert.txt >/dev/null || true
  elif [ -n "${RESEND_API_KEY:-}" ]; then
    local to_json
    to_json="$(echo "$ALERT_EMAILS" | awk -F, '{for(i=1;i<=NF;i++){gsub(/ /,"",$i); printf "%s\"%s\"", (i>1?",":""), $i}}')"
    curl -s -m 15 -X POST https://api.resend.com/emails -H "Authorization: Bearer ${RESEND_API_KEY}" -H "Content-Type: application/json" \
      -d "{\"from\":\"${from}\",\"to\":[${to_json}],\"subject\":\"${subject}\",\"text\":\"${body}\"}" >/dev/null || true
  fi
}
trap 'echo "[backup] FAILED at: ${STEP}" >&2; alert' ERR

# ── 1. database ──
STEP="database dump"
echo "[backup] dumping database → ${FILE}"
pg_dump --no-owner --no-privileges --clean --if-exists --format=plain "$DATABASE_URL" | gzip -9 > "$FILE"

# Sanity check: a valid dump is never tiny and must decompress cleanly.
STEP="checking the dump"
gzip -t "$FILE"
SIZE=$(stat -c %s "$FILE")
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] ERROR: dump is suspiciously small (${SIZE} bytes) – aborting" >&2
  false
fi
echo "[backup] dump size: ${SIZE} bytes"

STEP="encrypting the dump"
FILE="$(encrypt "$FILE")"

STEP="uploading the dump"
echo "[backup] uploading → s3://${DEST_BUCKET}/${KEY}"
s3_dest cp "$FILE" "s3://${DEST_BUCKET}/${KEY}" --content-type application/octet-stream --only-show-errors
rm -f "$FILE"

# ── 2. private uploads (daily, one archive) ──
STEP="archiving private uploads"
mkdir -p /tmp/private
for folder in $PRIVATE_FOLDERS; do
  s3_src sync "s3://${S3_BUCKET}/${folder}/" "/tmp/private/${folder}/" --only-show-errors
done
ARCHIVE="/tmp/${DATE}.tar.gz"
tar -czf "$ARCHIVE" -C /tmp/private .
rm -rf /tmp/private
ARCHIVE="$(encrypt "$ARCHIVE")"
STEP="uploading private uploads"
echo "[backup] uploading private uploads → s3://${DEST_BUCKET}/${PREFIX}-private/${DATE}.tar.gz${ENC}"
s3_dest cp "$ARCHIVE" "s3://${DEST_BUCKET}/${PREFIX}-private/${DATE}.tar.gz${ENC}" --content-type application/octet-stream --only-show-errors
rm -f "$ARCHIVE"

# ── 3. public photos (weekly) ──
if [ "${BACKUP_MEDIA:-true}" != "false" ] && { [ "$(TZ=Asia/Karachi date +%u)" = "7" ] || [ "${BACKUP_MEDIA_DAILY:-false}" = "true" ]; }; then
  STEP="copying photos"
  for folder in $PUBLIC_FOLDERS; do
    # media/ has always been copied straight into backups-media/ – keep that layout for it
    dest="${PREFIX}-media/${folder}/"; [ "$folder" = "media" ] && dest="${PREFIX}-media/"
    echo "[backup] copying photos (${folder}/) → s3://${DEST_BUCKET}/${dest}"
    mkdir -p "/tmp/photos/${folder}"
    s3_src sync "s3://${S3_BUCKET}/${folder}/" "/tmp/photos/${folder}/" --only-show-errors
    s3_dest sync "/tmp/photos/${folder}/" "s3://${DEST_BUCKET}/${dest}" --only-show-errors
    rm -rf "/tmp/photos/${folder}"
  done
fi

# ── 4. old database / private backups ──
STEP="deleting old backups"
CUTOFF="$(date -u -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +%Y-%m-%d)"
echo "[backup] pruning backups older than ${CUTOFF} (${RETENTION_DAYS} days)"
for dir in "${PREFIX}" "${PREFIX}-private"; do
  s3_dest ls "s3://${DEST_BUCKET}/${dir}/" | awk '{print $4}' | while read -r name; do
    [[ "$name" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})\.(sql|tar)\.gz(\.enc)?$ ]] || continue
    if [[ "${BASH_REMATCH[1]}" < "$CUTOFF" ]]; then
      echo "[backup] deleting ${dir}/${name}"
      s3_dest rm "s3://${DEST_BUCKET}/${dir}/${name}" --only-show-errors
    fi
  done
done

# ── 5. heartbeat: "tonight's backup worked" (the heartbeat service alerts when this doesn't arrive) ──
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  curl -fsS -m 15 --retry 3 "$BACKUP_HEARTBEAT_URL" >/dev/null || echo "[backup] warning: heartbeat ping failed" >&2
fi

echo "[backup] done"
