import { feedItems, toTikTokCsv } from "@/lib/feeds";
import { currentAvailability, toStoreUrls } from "@/lib/tenant";

/** TikTok catalog feed (CSV). Each store has its own. */
export const dynamic = "force-dynamic";

export async function GET() {
  const { availability } = await currentAvailability();
  const items = availability.open ? await feedItems("tiktok") : null;
  if (!items) return new Response("This feed is switched off in /cms → Settings → Sales channels.", { status: 404 });
  return new Response(await toStoreUrls(toTikTokCsv(items)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
