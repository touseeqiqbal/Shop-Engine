"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import type { Brand, LaptopModel } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Find Parts for Your Laptop": brand → model, then navigates to /find-parts?model=… which lists
 * compatible chargers, batteries, keyboards, RAM and SSDs.
 */
export function CompatibilityFinder({
  brands,
  models,
  initialModel,
  className,
  compact,
}: {
  brands: Brand[];
  models: LaptopModel[];
  initialModel?: string;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const initial = models.find((m) => m.id === initialModel);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.id ?? "");

  const brandOptions = useMemo(() => brands.filter((b) => models.some((m) => m.brand === b.slug)), [brands, models]);
  const grouped = useMemo(() => {
    const g = new Map<string, LaptopModel[]>();
    for (const m of models.filter((m) => m.brand === brand)) g.set(m.series, [...(g.get(m.series) ?? []), m]);
    return [...g.entries()];
  }, [models, brand]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (model) router.push(`/find-parts?model=${encodeURIComponent(model)}`);
      }}
      className={cn("grid gap-3", compact ? "sm:grid-cols-[1fr_1fr_auto]" : "md:grid-cols-[1fr_1.4fr_auto]", className)}
      aria-label="Find compatible parts for your laptop"
    >
      <div>
        <label htmlFor="finder-brand" className="label">
          1. Laptop brand
        </label>
        <select
          id="finder-brand"
          className="input"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setModel("");
          }}
          required
        >
          <option value="">Select brand</option>
          {brandOptions.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="finder-model" className="label">
          2. Model
        </label>
        <select id="finder-model" className="input" value={model} onChange={(e) => setModel(e.target.value)} disabled={!brand} required>
          <option value="">{brand ? "Select model" : "Choose a brand first"}</option>
          {grouped.map(([series, list]) => (
            <optgroup key={series} label={series}>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn btn-primary w-full min-h-[2.875rem]" disabled={!model}>
          {compact ? <Search className="size-4" aria-hidden="true" /> : <Wrench className="size-4" aria-hidden="true" />}
          Find parts
        </button>
      </div>
    </form>
  );
}
