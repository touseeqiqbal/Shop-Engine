# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Urko Tech Store – production image (Railway)
#   deps      → npm ci (all deps)
#   builder   → payload migrate (when the database is reachable) + next build (output: "standalone")
#   runner    → node server.js as non-root user
# The legacy Prisma tables are frozen (read only by the data-migration tools) – no Prisma migrations run any more.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
# openssl: used by the Prisma client of the legacy data tools
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
# `postinstall` runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the JS bundle at build time, so they must be build args.
# Railway passes service variables with matching names automatically.
ARG NEXT_PUBLIC_SITE_URL
# Staging service only: STAGING=true → noindex headers + robots disallow are baked into the build.
ARG STAGING
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_FB_DOMAIN_VERIFICATION
ARG NEXT_PUBLIC_BING_SITE_VERIFICATION
# Cloudflare Turnstile (bot check) and Sentry (browser errors) – the browser part must be built in too.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    STAGING=$STAGING \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_FB_DOMAIN_VERIFICATION=$NEXT_PUBLIC_FB_DOMAIN_VERIFICATION \
    NEXT_PUBLIC_BING_SITE_VERIFICATION=$NEXT_PUBLIC_BING_SITE_VERIFICATION \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
# Regenerate the client into src/generated (never connects to the database).
RUN npx prisma generate
# Pages, the sitemap and the product feeds are pre-built from the shop's data in /cms. Railway's private network
# isn't reachable while building, so set the service variable
#   DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}
# PAYLOAD_SECRET (already a service variable) is passed in as well. Both are build ARGs of this stage only –
# they are never copied into the final image. Payload's migrations run first (they only ever ADD things, so the
# live site keeps working until the new version replaces it), then the build reads the up-to-date schema.
ARG DATABASE_BUILD_URL
ARG PAYLOAD_SECRET
# Without them the build would pre-render pages from the built-in demo catalog – so it stops instead (the live site
# keeps running the previous version). The steps live in a script so the build log never shows a secret: Railway
# prints each RUN line with the build variables filled in. Never write $PAYLOAD_SECRET in a RUN line here.
RUN sh scripts/docker-build.sh

# Bundle the maintenance tools (seed, data migration, fingerprint, smoke test) into self-contained files
# that run with plain `node` in the production container – see scripts/build-console-tools.mjs.
RUN node scripts/build-console-tools.mjs

# ── runner ───────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed.mjs /app/dist/migrate-data.mjs /app/dist/fingerprint-legacy.mjs /app/dist/smoke-test.mjs ./
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
# Guard against CRLF line endings when the repo is checked out on Windows.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/.data && chown nextjs:nodejs /app/.data

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
