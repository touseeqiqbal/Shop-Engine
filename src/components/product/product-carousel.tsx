"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogProduct } from "@/lib/types";
import { ProductCard } from "./product-card";

/** Swipeable, scroll-snapping product row with desktop arrow controls. */
export function ProductCarousel({ products, label }: { products: CatalogProduct[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  if (!products.length) return null;
  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={ref} className="snap-row -mx-4 scroll-px-4 px-4 pb-4 pt-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] sm:w-[32%] md:w-[30%] lg:w-[23.5%] xl:w-[19%]">
            <ProductCard product={p} className="h-full" />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="glass absolute -left-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full shadow-xl transition hover:scale-105 lg:grid"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="glass absolute -right-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full shadow-xl transition hover:scale-105 lg:grid"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
