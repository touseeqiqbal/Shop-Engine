import { isCmsConfigured } from "@/lib/db/config";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /download/<token> – a digital product's file for the customer who bought it (src/payload/downloads.ts
 * serveDownload: signed token, PAID order, download period, per-file limit; streamed from the private downloads/ store).
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { downloadPage, serveDownload } = await import("@/payload/downloads");
  if (!isCmsConfigured) return downloadPage(404, "Downloads aren't available in this shop.");
  if (!(await rateLimit("download", 30, 10 * 60_000))) return downloadPage(429, "Too many downloads in a short time – please try again in a few minutes.");
  const { token } = await ctx.params;
  const { payloadClient } = await import("@/lib/cms/catalog-source");
  return serveDownload(await payloadClient(), token);
}
