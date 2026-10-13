"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useCart } from "@/store/cart";
import { trackEvent } from "@/components/analytics";
import type { CatalogProduct, UpgradeOption } from "@/lib/types";

/** "Buy again": puts the order's items (today's price, only what is still for sale) back in the cart. */
export function BuyAgain({ lines, unavailable }: { lines: { product: CatalogProduct; qty: number; upgrades: UpgradeOption[] }[]; unavailable: string[] }) {
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!lines.length) return unavailable.length ? <p className="text-sm text-muted">These items aren&apos;t available any more.</p> : null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          for (const l of lines) add(l.product, { qty: l.qty, upgrades: l.upgrades, openDrawer: false });
          trackEvent("add_to_cart", { source: "buy_again", items: lines.length });
          router.push("/cart");
        }}
      >
        <RotateCcw className="size-4" aria-hidden="true" /> Buy again
      </button>
      {unavailable.length > 0 && <p className="text-xs text-muted">Not available any more: {unavailable.join(", ")}.</p>}
      <p className="text-xs text-subtle">Added at today&apos;s price – you can change quantities in the cart.</p>
    </div>
  );
}
