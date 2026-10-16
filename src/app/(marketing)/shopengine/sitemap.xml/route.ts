import { marketingOrigin } from "@/lib/marketing/seo";
import { marketingRoutes } from "@/lib/marketing/routes";

/** The marketing site's sitemap (served at /sitemap.xml on MARKETING_HOSTS – see src/proxy.ts). */
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const origin = await marketingOrigin();
  const urls = marketingRoutes()
    .map((r) => `  <url>\n    <loc>${xml(`${origin}${r.path === "/" ? "/" : r.path}`)}</loc>${r.lastModified ? `\n    <lastmod>${r.lastModified}</lastmod>` : ""}\n    <changefreq>${r.changeFrequency}</changefreq>\n    <priority>${r.priority.toFixed(1)}</priority>\n  </url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
