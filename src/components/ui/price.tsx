"use client";
import { useMoney } from "@/components/providers/locale";
import { cn, discountPercent, effectivePrice } from "@/lib/utils";

export function Price({
  price,
  salePrice,
  size = "md",
  className,
  showSave,
}: {
  price: number;
  salePrice?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSave?: boolean;
}) {
  const money = useMoney();
  const now = effectivePrice({ price, salePrice });
  const onSale = now < price;
  const sizes = { sm: "text-base", md: "text-lg", lg: "text-2xl", xl: "text-3xl sm:text-4xl" };
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-display font-bold tabular-nums text-fg", sizes[size])}>{money(now)}</span>
      {onSale && (
        <>
          <s className="text-sm tabular-nums text-subtle">
            <span className="sr-only">Regular price </span>
            {money(price)}
          </s>
          {showSave && (
            <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
              You save {money(price - now)} ({discountPercent({ price, salePrice })}%)
            </span>
          )}
        </>
      )}
    </div>
  );
}
