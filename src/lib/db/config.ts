/**
 * Production never runs without its real database and photo storage: no "demo mode", no orders kept in memory,
 * no files on the container's disk (all lost on the next deploy). The server refuses to start instead
 * (lib/startup-checks.ts) and every write path refuses too.
 * The only exception is LOCAL_PRODUCTION_TEST=true for testing a production build on a developer's PC – it is
 * ignored on Railway.
 */
export const localProductionTest =
  process.env.LOCAL_PRODUCTION_TEST === "true" && !process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_ENVIRONMENT_NAME && !process.env.RAILWAY_PROJECT_ID;
export const strictProduction = process.env.NODE_ENV === "production" && !localProductionTest;
export const isStorageEnvSet = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

/** When false the store runs in "demo mode" on the in-memory seed catalog (development only – see above). */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

/** Payload can start: database + secret (in development a built-in dev secret is used). */
export const isCmsConfigured = isDatabaseConfigured && (Boolean(process.env.PAYLOAD_SECRET) || process.env.NODE_ENV !== "production");

/**
 * Connections per pool. `next build` prerenders in many worker processes, each with its own pools, so keep them
 * tiny there (Railway Postgres allows ~100 connections in total). Override with DB_POOL_MAX.
 */
export const dbPoolMax = Number(process.env.DB_POOL_MAX) || (process.env.NEXT_PHASE === "phase-production-build" ? 2 : 10);
