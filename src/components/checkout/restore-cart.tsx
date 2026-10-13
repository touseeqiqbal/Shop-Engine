"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/store/cart";

export type RestoreLine = { productId: string; name: string; qty: number; unitPrice: number; slug: string; url: string; image: string; brandName: string };

/** Puts a saved (abandoned) cart back and goes to checkout. Prices and stock are checked again at checkout. */
export function RestoreCart({ lines }: { lines: RestoreLine[] }) {
  const router = useRouter();
  useEffect(() => {
    if (!lines.length) return;
    const current = useCart.getState().lines;
    const merged = [...current];
    for (const l of lines) {
      if (merged.some((m) => m.productId === l.productId && !m.upgrades?.length)) continue;
      merged.push({ key: l.productId, productId: l.productId, slug: l.slug, name: l.name, image: l.image, url: l.url, brandName: l.brandName, basePrice: l.unitPrice, unitPrice: l.unitPrice, qty: l.qty, stock: 20, upgrades: [] });
    }
    useCart.setState({ lines: merged });
    router.replace("/checkout");
  }, [lines, router]);
  if (lines.length) return <p className="container-x py-16 text-center text-muted">Bringing back your cart…</p>;
  return (
    <div className="container-x py-16">
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold">This cart has expired</h1>
        <p className="mt-2 text-muted">The items may have sold out or the link is old.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
