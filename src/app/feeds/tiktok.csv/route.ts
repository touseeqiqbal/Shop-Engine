import { feedItems, toTikTokCsv } from "@/lib/feeds";

/** TikTok catalog feed (CSV). */
export const revalidate = 3600;

export async function GET() {
  const items = await feedItems("tiktok");
  if (!items) return new Response("This feed is switched off in /cms → Settings → Sales channels.", { status: 404 });
  return new Response(toTikTokCsv(items), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
