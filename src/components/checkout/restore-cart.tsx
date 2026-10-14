"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lineKey, useCart } from "@/store/cart";
import type { UpgradeOption } from "@/lib/types";

export type RestoreLine = { productId: string; name: string; qty: number; unitPrice: number; slug: string; url: string; image: string; brandName: string; upgrades: UpgradeOption[] };

/** Puts a saved (abandoned) cart back and goes to checkout. Prices and stock are checked again at checkout. */
export function RestoreCart({ lines }: { lines: RestoreLine[] }) {
  const router = useRouter();
  useEffect(() => {
    if (!lines.length) return;
    const current = useCart.getState().lines;
    const merged = [...current];
    for (const l of lines) {
      const key = lineKey(l.productId, l.upgrades);
      if (merged.some((m) => m.key === key)) continue;
      const extra = l.upgrades.reduce((s, u) => s + u.price, 0);
      merged.push({ key, productId: l.productId, slug: l.slug, name: l.name, image: l.image, url: l.url, brandName: l.brandName, basePrice: l.unitPrice - extra, unitPrice: l.unitPrice, qty: l.qty, stock: 20, upgrades: l.upgrades });
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
