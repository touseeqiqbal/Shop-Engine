#!/bin/sh
# Docker build step (called by the Dockerfile's builder stage).
#
# Lives in a script ON PURPOSE: Railway prints every Dockerfile RUN command in the build log with the build
# variables filled in, so a RUN line that mentions $PAYLOAD_SECRET would show the secret in the log. Build args
# are plain environment variables inside this script, so nothing secret is ever printed.
#
# Needs (Railway → web service → Variables):
#   DATABASE_BUILD_URL = ${{Postgres.DATABASE_PUBLIC_URL}}   (the private network isn't reachable while building)
#   PAYLOAD_SECRET     = the same secret the running site uses
# Without them the build would pre-render pages from the built-in demo catalog, so it stops instead
# (the live site keeps running the previous version).
set -eu

if [ -z "${DATABASE_BUILD_URL:-}" ] || [ -z "${PAYLOAD_SECRET:-}" ]; then
  missing=""
  [ -z "${DATABASE_BUILD_URL:-}" ] && missing="DATABASE_BUILD_URL"
  [ -z "${PAYLOAD_SECRET:-}" ] && missing="${missing:+$missing and }PAYLOAD_SECRET"
  echo "ERROR: $missing not set on this Railway service. Add DATABASE_BUILD_URL = \${{Postgres.DATABASE_PUBLIC_URL}} (and PAYLOAD_SECRET) under Variables, then redeploy." >&2
  exit 1
fi

export DATABASE_URL="$DATABASE_BUILD_URL"
export NODE_ENV=production

# Payload's migrations only ever ADD things, so the live site keeps working until the new version replaces it.
echo "[build] payload migrate"
npx payload migrate
echo "[build] next build"
npm run build
