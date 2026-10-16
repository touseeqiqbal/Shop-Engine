import { marketingOrigin } from "@/lib/marketing/seo";

/** The marketing site's robots rules (served at /robots.txt on MARKETING_HOSTS – see src/proxy.ts). Staging: nothing indexed. */
export async function GET() {
  const origin = await marketingOrigin();
  const body =
    process.env.STAGING === "true"
      ? "User-agent: *\nDisallow: /\n"
      : ["User-agent: *", "Allow: /", "Disallow: /account", "Disallow: /cms", "Disallow: /cms-api", "Disallow: /api", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
