import { feedItems, toGoogleXml } from "@/lib/feeds";
import { site } from "@/lib/site";

/** Meta (Facebook / Instagram) catalog feed – Meta reads the same RSS format as Google. */
export const revalidate = 3600;

export async function GET() {
  const items = await feedItems("meta");
  if (!items) return new Response("This feed is switched off in /cms → Settings → Sales channels.", { status: 404 });
  return new Response(toGoogleXml(items, `${site.name} – Meta`), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
