import { feedItems, toGoogleXml } from "@/lib/feeds";
import { getSiteInfo } from "@/lib/repo/site-content";
import { currentAvailability, toStoreUrls } from "@/lib/tenant";

/** Google Merchant Center product feed (refreshes hourly and when products change). Each store has its own. */
export const dynamic = "force-dynamic";

export async function GET() {
  const { availability } = await currentAvailability();
  const items = availability.open ? await feedItems("google") : null;
  if (!items) return new Response("This feed is switched off in /cms → Settings → Sales channels.", { status: 404 });
  const info = await getSiteInfo();
  return new Response(await toStoreUrls(toGoogleXml(items, `${info.name} – Google`, info.name)), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
