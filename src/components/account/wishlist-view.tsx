"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { setWishlistAction, syncWishlistAction } from "@/app/(frontend)/(store)/account/actions";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import type { CatalogProduct } from "@/lib/types";
import { useLists } from "@/store/lists";

export function WishlistView({ signedIn }: { signedIn: boolean }) {
  const hydrated = useHydrated();
  const wishlist = useLists((s) => s.wishlist);
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [synced, setSynced] = useState(!signedIn);
  const cache = useRef(new Map<string, CatalogProduct>());

  // One-time merge of the local wishlist with the account wishlist
  useEffect(() => {
    if (!hydrated || !signedIn || synced) return;
    let cancelled = false;
    syncWishlistAction(useLists.getState().wishlist)
      .then((merged) => {
        if (!cancelled && merged) useLists.setState({ wishlist: merged });
      })
      .finally(() => !cancelled && setSynced(true));
    return () => {
      cancelled = true;
    };
  }, [hydrated, signedIn, synced]);

  // Keep the account copy updated after removals/additions
  const first = useRef(true);
  useEffect(() => {
    if (!signedIn || !synced) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void setWishlistAction(wishlist), 600);
    return () => clearTimeout(t);
  }, [wishlist, signedIn, synced]);

  // Fetch product data for ids we haven't loaded yet
  useEffect(() => {
    if (!hydrated || !synced) return;
    const missing = wishlist.filter((id) => !cache.current.has(id));
    const render = () => setProducts(wishlist.map((id) => cache.current.get(id)).filter((p): p is CatalogProduct => Boolean(p)));
    if (!missing.length) return render();
    const ctrl = new AbortController();
    // the API returns at most 12 products per request
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 12) chunks.push(missing.slice(i, i + 12));
    Promise.all(
      chunks.map((ids) =>
        fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`, { signal: ctrl.signal }).then((r) =>
          r.ok ? (r.json() as Promise<CatalogProduct[]>) : []
        )
      )
    )
      .then((lists) => {
        for (const p of lists.flat()) cache.current.set(p.id, p);
        render();
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setProducts([]);
      });
    return () => ctrl.abort();
  }, [wishlist, hydrated, synced]);

  if (!hydrated || !synced || products === null) return <ProductGridSkeleton count={4} />;

  if (products.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-surface-strong">
          <Heart className="size-9 text-rose-300" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold">Your wishlist is empty</h2>
        <p className="max-w-sm text-sm text-muted">Tap the heart on any product to save it here for later.</p>
        <Link href="/shop" className="btn btn-primary mt-2">
          Discover products
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {products.length} saved item{products.length === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
