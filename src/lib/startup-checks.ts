import { configWarnings } from "./config-warnings";
import { isStorageEnvSet, localProductionTest, strictProduction } from "./db/config";

/**
 * Node.js only (loaded by instrumentation.ts with `import()`, so the Edge bundle never sees `process.exit`).
 * Fail fast: without PAYLOAD_SECRET the admin can't start and the shop would fall back to old/demo data.
 * Exiting makes Railway's health check fail, so the previous version keeps serving customers.
 */
export function runStartupChecks() {
  if (strictProduction) {
    // no database → orders would be kept in memory; no bucket → photos and payment screenshots on the container's
    // disk. Both are lost on the next deploy, so the server doesn't start at all (Railway keeps the old version).
    const missing = ["DATABASE_URL", "PAYLOAD_SECRET", "AUTH_SECRET"].filter((k) => !process.env[k]);
    if (!isStorageEnvSet) missing.push("S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY");
    if (missing.length) {
      console.error(`[startup] ${missing.join(", ")} not set – refusing to start. Set them in Railway → Variables.`);
      process.exit(1);
    }
  } else if (localProductionTest) console.error("[startup] LOCAL_PRODUCTION_TEST – local test of a production build (never on Railway).");
  for (const w of configWarnings()) console.error(`[startup] WARNING: ${w}`);
}
