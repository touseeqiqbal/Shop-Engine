#!/bin/sh
# Container entrypoint: start Next.js.
# Payload's pending database migrations run when the server starts (prodMigrations in src/payload.config.ts) –
# before it answers the health check. (MIGRATE_DURING_BUILD=true also runs them during the build.)
# The legacy Prisma tables are frozen – no migrations.
set -e
exec "$@"
