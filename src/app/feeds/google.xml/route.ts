import { feedItems, toGoogleXml } from "@/lib/feeds";
import { site } from "@/lib/site";

/** Google Merchant Center product feed (refreshes hourly and when products change). */
export const revalidate = 3600;

export async function GET() {
  const items = await feedItems("google");
  if (!items) return new Response("This feed is switched off in /cms → Settings → Sales channels.", { status: 404 });
  return new Response(toGoogleXml(items, `${site.name} – Google`), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
