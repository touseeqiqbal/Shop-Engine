"use client";
import type { CatalogProduct } from "@/lib/types";
import { canOrder, cn } from "@/lib/utils";

export type VariantOptions = NonNullable<CatalogProduct["variantOptions"]>;

/** The variant whose options match every choice, or null. */
export function matchVariant(variants: CatalogProduct[], options: VariantOptions, pick: Record<string, string>) {
  return variants.find((v) => options.every((o) => (v.optionValues ?? {})[o.name] === pick[o.name])) ?? null;
}

/** Start with the variant from ?variant=… or else the first one in stock (else the first). */
export function initialPick(variants: CatalogProduct[], slug?: string | null): Record<string, string> {
  const v = (slug && variants.find((x) => x.slug === slug)) || variants.find((x) => canOrder(x)) || variants[0];
  return { ...(v?.optionValues ?? {}) };
}

/**
 * Option buttons (e.g. Colour: Black / Silver, Size: S / M / L). A value that makes no existing combination is disabled;
 * one whose variant is sold out is crossed out but still selectable (so shoppers can ask for a stock alert).
 */
export function VariantPicker({
  options,
  variants,
  pick,
  onPick,
}: {
  options: VariantOptions;
  variants: CatalogProduct[];
  pick: Record<string, string>;
  onPick: (name: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {options.map((o) => (
        <fieldset key={o.name}>
          <legend className="mb-2 text-sm text-muted">
            {o.name}: <span className="font-semibold text-fg">{pick[o.name] ?? "Choose"}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {o.values.map((value) => {
              const v = matchVariant(variants, options, { ...pick, [o.name]: value });
              const selected = pick[o.name] === value;
              const soldOut = v ? !canOrder(v) : false;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!v}
                  aria-pressed={selected}
                  aria-label={`${o.name}: ${value}${!v ? " – not available" : soldOut ? " – sold out" : ""}`}
                  onClick={() => onPick(o.name, value)}
                  className={cn(
                    "min-h-11 min-w-11 rounded-xl border px-4 text-sm font-semibold transition",
                    selected ? "border-violet-400 bg-violet-500/15 text-fg" : "border-border bg-surface text-fg hover:border-violet-400/60",
                    soldOut && "text-muted line-through",
                    !v && "cursor-not-allowed opacity-40"
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
