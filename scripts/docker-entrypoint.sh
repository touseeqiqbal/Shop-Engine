#!/bin/sh
# Container entrypoint: start Next.js.
# Payload's database migrations run during the build (Dockerfile) and again, if any are still pending, when the
# server starts (prodMigrations in src/payload.config.ts). The legacy Prisma tables are frozen – no migrations.
set -e
exec "$@"
