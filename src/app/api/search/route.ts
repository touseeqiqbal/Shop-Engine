import { NextResponse, type NextRequest } from "next/server";
import { getCategories, searchProducts, searchSuggestion } from "@/lib/repo/catalog";
import { effectivePrice } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80).trim();
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });

  const [products, categories] = await Promise.all([searchProducts(q, 8), getCategories()]);
  const ql = q.toLowerCase();
  const matchedCats = categories
    .filter((c) => c.name.toLowerCase().includes(ql) || ql.split(/\s+/).some((t) => t.length > 2 && c.name.toLowerCase().includes(t)))
    .slice(0, 4)
    .map((c) => ({ name: c.name, slug: c.slug }));

  return NextResponse.json(
    {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        image: p.images[0],
        price: effectivePrice(p),
        priceOnRequest: Boolean(p.priceOnRequest),
        brandName: p.brandName,
        categoryName: p.categoryName,
      })),
      categories: matchedCats,
      didYouMean: products.length ? null : await searchSuggestion(q),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
