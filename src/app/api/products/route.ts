import { NextResponse, type NextRequest } from "next/server";
import { getProductsByIds } from "@/lib/repo/catalog";
import type { CatalogProduct } from "@/lib/types";

/** Fields the compare page needs (and that ProductCard / cart `add` read). Heavy Markdown is dropped. */
export type CompareProduct = Omit<CatalogProduct, "description" | "boughtTogether" | "upgrades" | "video"> & {
  description: "";
  boughtTogether: [];
  upgrades: [];
};

/** GET /api/products?ids=a,b,c → CompareProduct[] (active products only, max 12, in the requested order). Used by /compare and "Recently viewed". */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,100}$/.test(s))
    .slice(0, 12);
  if (!ids.length) return NextResponse.json([]);

  const products = await getProductsByIds([...new Set(ids)]);
  // the store's own products only (getProductsByIds reads the current store); exact stock and sales counts stay private
  const slim: CompareProduct[] = products.map(({ description: _d, boughtTogether: _b, upgrades: _u, video: _v, ...p }) => ({
    ...p,
    stock: Math.min(Math.max(0, p.stock), 10),
    soldCount: 0,
    description: "",
    boughtTogether: [],
    upgrades: [],
  }));
  return NextResponse.json(
    slim,
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
