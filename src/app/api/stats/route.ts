import { headers } from "next/headers";
import { isCmsConfigured } from "@/lib/db/config";
import { isBot, STAT_KINDS, validRef, type StatKind } from "@/lib/shop-stats";
import { rateLimit } from "@/lib/rate-limit";
import { currentStoreId } from "@/lib/tenant";
import { getStoreLocale } from "@/lib/store-locale";
import { dayIn } from "@/lib/time";
import { log } from "@/lib/log";
import { getProductsByIds } from "@/lib/repo/catalog";

/**
 * POST /api/stats  {"k":"view"|"cart"|"checkout","p":"<product id>"} – one shop event for Reports → Shop funnel
 * (sent by the browser with sendBeacon). Counts only: nothing about the visitor is stored. Bots are ignored.
 */
const done = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  if (!isCmsConfigured) return done();
  const h = await headers();
  if (isBot(h.get("user-agent"))) return done();
  if (!(await rateLimit("shop-stats", 120, 60_000))) return done();
  const body = (await req.text().catch(() => "")).slice(0, 300);
  let input: { k?: unknown; p?: unknown } = {};
  try {
    input = JSON.parse(body) as typeof input;
  } catch {
    return done();
  }
  const kind = STAT_KINDS.find((k) => k === input.k) as StatKind | undefined;
  const ref = validRef(input.p);
  if (!kind || ref === null) return done();
  try {
    const [storeId, loc, { payloadClient }, { recordStat }] = await Promise.all([currentStoreId(), getStoreLocale(), import("@/lib/cms/catalog-source"), import("@/payload/shop-stats")]);
    // only a real store's own products: no store (ShopEngine's own site, an unknown address) counts nothing, and a
    // made-up product id isn't a row – anyone can call this, so it must not fill the table with junk
    if (storeId == null) return done();
    if (kind !== "checkout" && ref && !(await getProductsByIds([ref])).length) return done();
    await recordStat(await payloadClient(), { storeId, day: dayIn(Date.now(), loc.timezone), kind, ref: kind === "checkout" ? "" : ref });
  } catch (e) {
    log.warn("stats.record_failed", { error: e instanceof Error ? e.message : String(e) });
  }
  return done();
}
