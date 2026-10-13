import Link from "next/link";
import { Wrench } from "lucide-react";
import { getBrands, getLaptopModels } from "@/lib/repo/catalog";
import { CompatibilityFinder } from "@/components/product/compatibility-finder";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact "Find parts for your laptop" panel shown on compatibility-enabled categories. */
export async function FinderPanel({ category, className }: { category: Category; className?: string }) {
  const [brands, models] = await Promise.all([getBrands(), getLaptopModels()]);
  return (
    <section
      aria-labelledby="finder-panel-heading"
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-blue-600/5 to-violet-600/10 p-4 sm:p-6",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-center lg:gap-8">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white">
            <Wrench className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="finder-panel-heading" className="text-lg font-bold text-fg sm:text-xl">
              Find parts for your laptop
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Not sure which {category.name.toLowerCase()} fits? Pick your model and we&apos;ll show only compatible parts.{" "}
              <Link href="/find-parts" className="font-semibold text-violet-400 hover:text-violet-300">
                How it works
              </Link>
            </p>
          </div>
        </div>
        <CompatibilityFinder brands={brands} models={models} compact />
      </div>
    </section>
  );
}
