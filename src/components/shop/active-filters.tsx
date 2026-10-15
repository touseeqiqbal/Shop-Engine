"use client";
import { X } from "lucide-react";
import type { Condition } from "@/lib/types";
import { conditionMeta } from "@/lib/utils";
import { useMoney } from "@/components/providers/locale";
import { useListing } from "./listing-context";

export interface FilterLabels {
  brands: Record<string, string>;
  /** attribute key → { label, unit } */
  attrs: Record<string, { label: string; unit?: string }>;
}

interface Chip {
  key: string;
  label: string;
  remove: (p: URLSearchParams) => void;
}

/** Removable chips for every active filter, plus "Clear all". Hidden when nothing is filtered. */
export function ActiveFilters({ labels, keepParams = [] }: { labels: FilterLabels; keepParams?: string[] }) {
  const { params, update } = useListing();
  const money = useMoney();
  const chips: Chip[] = [];

  const removeFromList = (key: string, value: string) => (p: URLSearchParams) => {
    const next = (p.get(key) ?? "").split(",").filter((v) => v && v !== value);
    if (next.length) p.set(key, next.join(","));
    else p.delete(key);
  };

  for (const [key, raw] of params.entries()) {
    if (!raw) continue;
    if (key === "brand") for (const v of raw.split(",").filter(Boolean)) chips.push({ key: key + v, label: labels.brands[v] ?? v, remove: removeFromList(key, v) });
    else if (key === "condition")
      for (const v of raw.split(",").filter(Boolean))
        chips.push({ key: key + v, label: conditionMeta[v as Condition]?.label ?? v, remove: removeFromList(key, v) });
    else if (key === "stock") chips.push({ key, label: "In stock", remove: (p) => p.delete("stock") });
    else if (key.startsWith("a_")) {
      const meta = labels.attrs[key.slice(2)];
      for (const v of raw.split(",").filter(Boolean))
        chips.push({
          key: key + v,
          label: v === "true" ? meta?.label ?? key.slice(2) : `${meta?.label ?? key.slice(2)}: ${v}${meta?.unit ? ` ${meta.unit}` : ""}`,
          remove: removeFromList(key, v),
        });
    } else if (key.startsWith("r_")) {
      const meta = labels.attrs[key.slice(2)];
      chips.push({ key, label: `${meta?.label ?? key.slice(2)}: ${raw.replace("-", " – ")}${meta?.unit ? ` ${meta.unit}` : ""}`, remove: (p) => p.delete(key) });
    }
  }
  const min = params.get("min");
  const max = params.get("max");
  if (min || max)
    chips.push({
      key: "price",
      label: `${min ? money(Number(min)) : "Any"} – ${max ? money(Number(max)) : "Any"}`,
      remove: (p) => (p.delete("min"), p.delete("max")),
    });

  if (!chips.length) return null;

  const clearAll = () =>
    update((p) => {
      for (const k of [...p.keys()]) if (!["sort", "view", ...keepParams].includes(k)) p.delete(k);
    });

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => update(c.remove)}
          className="chip min-h-8 border-violet-500/40 bg-violet-500/10 text-fg transition hover:border-violet-400 hover:bg-violet-500/20"
          aria-label={`Remove filter ${c.label}`}
        >
          {c.label}
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ))}
      <button type="button" onClick={clearAll} className="min-h-8 px-2 text-xs font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
        Clear all
      </button>
    </div>
  );
}

/** Number of active filters (for the mobile "Filters" badge). */
export function useActiveFilterCount() {
  const { params } = useListing();
  let n = 0;
  for (const [k, v] of params.entries()) {
    if (!v) continue;
    if (k === "brand" || k === "condition" || k.startsWith("a_")) n += v.split(",").filter(Boolean).length;
    else if (k === "stock" || k.startsWith("r_")) n += 1;
  }
  if (params.get("min") || params.get("max")) n += 1;
  return n;
}
