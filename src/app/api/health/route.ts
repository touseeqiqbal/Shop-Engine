import { isDatabaseConfigured, isStorageEnvSet, strictProduction } from "@/lib/db/config";
import { configWarnings } from "@/lib/config-warnings";
import { log } from "@/lib/log";

/**
 * Liveness/readiness probe for Railway (railway.json → healthcheckPath). Never cached.
 * Also boots Payload, which applies any pending committed migrations (prodMigrations). If that fails the
 * probe returns 503, Railway's deploy health check fails and the previous deployment keeps serving traffic.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  // production without its database is broken, not "demo" – report it so Railway / the uptime monitor see it
  if (!isDatabaseConfigured) return Response.json({ ok: !strictProduction, db: "none", cms: "off" }, { status: strictProduction ? 503 : 200, headers });
  if (strictProduction && !isStorageEnvSet) return Response.json({ ok: false, db: "up", storage: "missing" }, { status: 503, headers });
  const warnings = configWarnings();
  let payload: Awaited<ReturnType<typeof import("payload")["getPayload"]>>;
  try {
    const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@payload-config")]);
    payload = await getPayload({ config });
  } catch (e) {
    log.error("health.payload_cms_failed_to_start", e);
    return Response.json({ ok: false, db: "unknown", cms: "down" }, { status: 503, headers });
  }
  try {
    const { sql } = await import("@payloadcms/db-postgres");
    await (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle.execute(sql`select 1`);
  } catch (e) {
    log.error("health.database_check_failed", e);
    return Response.json({ ok: false, db: "down", cms: "up" }, { status: 503, headers });
  }
  try {
    // Payload answers (one row, not a count of every account on each probe)
    await payload.find({ collection: "users", limit: 1, depth: 0, pagination: false, overrideAccess: true });
    // only how many settings need attention (the details are on the /cms Home screen for platform admins)
    return Response.json({ ok: true, db: "up", cms: "up", ...(warnings.length ? { warnings: warnings.length } : {}) }, { headers });
  } catch (e) {
    log.error("health.payload_cms_check_failed", e);
    return Response.json({ ok: false, db: "up", cms: "down" }, { status: 503, headers });
  }
}
