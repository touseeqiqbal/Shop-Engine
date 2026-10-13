import { timingSafeEqual } from "node:crypto";
import { runHousekeeping } from "@/lib/housekeeping";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron  with header  Authorization: Bearer <CRON_SECRET>
 * Runs the housekeeping chores now (for an external scheduler such as a Railway cron service).
 * Also used by the server's own 5-minute timer (instrumentation.ts) with an internal key.
 * Answers 404 when neither key exists.
 */
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(req: Request) {
  // CRON_SECRET: an external scheduler; HOUSEKEEPING_INTERNAL_KEY: this server's own timer (instrumentation.ts)
  const keys = [process.env.CRON_SECRET, process.env.HOUSEKEEPING_INTERNAL_KEY].filter((k): k is string => Boolean(k));
  if (!keys.length) return new Response("Not found", { status: 404 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !keys.some((k) => same(given, k))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reason = new URL(req.url).searchParams.get("reason") || "cron";
  return Response.json(await runHousekeeping(reason.slice(0, 20)));
}
