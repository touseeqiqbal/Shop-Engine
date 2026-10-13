"use client";
import { ArrowUpDown } from "lucide-react";
import { useListing } from "./listing-context";
import { SORT_OPTIONS } from "./params";

export function SortSelect({ className }: { className?: string }) {
  const { params, update } = useListing();
  // "Best match" only makes sense while searching – and is the default then
  const searching = Boolean(params.get("q"));
  const fallback = searching ? "relevance" : "popular";
  const value = params.get("sort") ?? fallback;
  return (
    <div className={className}>
      <label htmlFor="listing-sort" className="sr-only">
        Sort products
      </label>
      <div className="relative">
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <select
          id="listing-sort"
          value={value}
          onChange={(e) => update((p) => (e.target.value === fallback ? p.delete("sort") : p.set("sort", e.target.value)))}
          className="input !min-h-10 cursor-pointer appearance-none !rounded-full !py-1.5 !pl-9 !pr-9 text-sm font-medium"
        >
          {SORT_OPTIONS.filter((o) => searching || o.value !== "relevance").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
