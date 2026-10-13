import type { CatalogProduct } from "@/lib/types";
import { cn, effectivePrice } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { ListViewEvent } from "./list-view-event";

export function ProductGrid({
  products,
  layout = "grid",
  className,
  priorityCount = 0,
}: {
  products: CatalogProduct[];
  layout?: "grid" | "list";
  className?: string;
  priorityCount?: number;
}) {
  return (
    <>
      <ListViewEvent items={products.map((p) => ({ item_id: p.sku, item_name: p.name, price: effectivePrice(p) }))} />
      <ul
        className={cn(
          layout === "list" ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4",
          className
        )}
      >
        {products.map((p, i) => (
          <li key={p.id} className="h-full">
            <ProductCard product={p} layout={layout} priority={i < priorityCount} className="h-full" />
          </li>
        ))}
      </ul>
    </>
  );
}
