import { getAllProducts, getProductBySlug } from "@/lib/repo/catalog";

/**
 * Old product links (/products/<name>) from the previous site: a PERMANENT redirect to the product's page, so
 * Google moves the old link's ranking over. Unknown names go to the shop search (temporary – it may exist later).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const s = decodeURIComponent(slug).toLowerCase();
  // a main product, or a variant (→ its main product's page with that option chosen)
  const product = (await getAllProducts().catch(() => [])).find((p) => p.slug.toLowerCase() === s) ?? (await getProductBySlug(s).catch(() => null));
  const target = product ? product.url : `/shop?q=${encodeURIComponent(s.replace(/-/g, " "))}`;
  return new Response(null, { status: product ? 301 : 307, headers: { Location: target, "Cache-Control": product ? "public, max-age=3600" : "no-store" } });
}
