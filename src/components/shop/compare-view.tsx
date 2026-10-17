"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { m as motion } from "framer-motion";
import { GitCompareArrows, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { CompareProduct } from "@/app/api/products/route";
import type { CatalogProduct } from "@/lib/types";
import { availabilityLabel, cn, conditionMeta } from "@/lib/utils";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/store/cart";
import { MAX_COMPARE, useLists } from "@/store/lists";
import { useHydrated } from "@/hooks/use-hydrated";
import { Toggle } from "./filters";

interface Row {
  label: string;
  values: (string | null)[];
  render?: (p: CompareProduct, i: number) => React.ReactNode;
}

const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const fmtAttr = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : v == null || v === "" ? null : String(v));

/** Side-by-side comparison of up to 3 products from the persisted compare list. */
export function CompareView() {
  const hydrated = useHydrated();
  const ids = useLists((s) => s.compare);
  const removeCompare = useLists((s) => s.removeCompare);
  const clearCompare = useLists((s) => s.clearCompare);
  const add = useCart((s) => s.add);
  const [cache, setCache] = useState<Record<string, CompareProduct>>({});
  const [loading, setLoading] = useState(true);
  const [onlyDiff, setOnlyDiff] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const missing = ids.filter((id) => !cache[id]);
    if (!missing.length) return setLoading(false);
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/products?ids=${encodeURIComponent(missing.join(","))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as CompareProduct[]) : [];
        setCache((c) => ({ ...c, ...Object.fromEntries(list.map((p) => [p.id, p])) }));
        // Drop ids that no longer exist (deleted / unpublished products).
        for (const id of missing) if (!list.some((p) => p.id === id)) removeCompare(id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => ctrl.abort();
  }, [hydrated, ids, cache, removeCompare]);

  const products = useMemo(() => ids.map((id) => cache[id]).filter((p): p is CompareProduct => Boolean(p)), [ids, cache]);

  const rows = useMemo<Row[]>(() => {
    if (!products.length) return [];
    const base: Row[] = [
      { label: "Price", values: products.map((p) => String(p.salePrice ?? p.price)), render: (p) => (p.priceOnRequest ? <span className="text-sm font-semibold">Price on request</span> : <Price price={p.price} salePrice={p.salePrice} size="sm" />) },
      { label: "Brand", values: products.map((p) => p.brandName) },
      { label: "Category", values: products.map((p) => p.categoryName) },
      { label: "Condition", values: products.map((p) => (p.condition ? conditionMeta[p.condition].label : "Brand New")) },
      {
        label: "Rating",
        values: products.map((p) => p.rating.toFixed(1)),
        render: (p) => (
          <span className="inline-flex items-center gap-1.5">
            <Stars rating={p.rating} />
            <span className="text-xs text-muted">
              {p.rating.toFixed(1)} ({p.reviewCount})
            </span>
          </span>
        ),
      },
      {
        label: "Availability",
        values: products.map((p) => availabilityLabel(p).label),
        render: (p) => {
          const s = availabilityLabel(p);
          return <span className={cn("font-medium", s.tone === "rose" ? "text-rose-400" : s.tone === "amber" ? "text-amber-400" : s.tone === "violet" ? "text-violet-300" : "text-emerald-400")}>{s.label}</span>;
        },
      },
      { label: "Warranty", values: products.map((p) => p.warranty || null) },
    ];

    const specLabels: string[] = [];
    for (const p of products) for (const s of p.specs) if (!specLabels.includes(s.label)) specLabels.push(s.label);
    const specRows: Row[] = specLabels.map((label) => ({
      label,
      values: products.map((p) => p.specs.find((s) => s.label === label)?.value ?? null),
    }));

    const known = new Set([...specLabels, ...base.map((r) => r.label)].map((l) => l.toLowerCase().replace(/[^a-z]/g, "")));
    const attrKeys: string[] = [];
    for (const p of products) for (const k of Object.keys(p.attributes)) if (!attrKeys.includes(k)) attrKeys.push(k);
    const attrRows: Row[] = attrKeys
      .filter((k) => !known.has(k.toLowerCase().replace(/[^a-z]/g, "")))
      .map((k) => ({ label: humanize(k), values: products.map((p) => fmtAttr(p.attributes[k])) }));

    return [...base, ...specRows, ...attrRows];
  }, [products]);

  const differs = (r: Row) => new Set(r.values.map((v) => v ?? "—")).size > 1;
  const visibleRows = onlyDiff && products.length > 1 ? rows.filter(differs) : rows;

  if (!hydrated || (loading && !products.length && ids.length > 0)) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" role="status" aria-label="Loading comparison">
        {Array.from({ length: Math.max(2, ids.length || 2) }, (_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="card relative overflow-hidden px-6 py-16 text-center sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
        <span className="relative mx-auto grid size-16 place-items-center rounded-3xl bg-surface-strong">
          <GitCompareArrows className="size-8 text-violet-400" aria-hidden="true" />
        </span>
        <h2 className="relative mt-5 text-xl font-bold text-fg sm:text-2xl">Nothing to compare yet</h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-muted sm:text-base">
          Tap the <GitCompareArrows className="inline size-4 align-[-2px]" aria-label="compare" /> icon on any product to add up to {MAX_COMPARE} products, then
          come back here to see specs, prices and warranty side by side.
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/category/laptops" className="btn btn-primary">
            Compare laptops
          </Link>
          <Link href="/shop" className="btn btn-secondary">
            Browse all products
          </Link>
        </div>
      </div>
    );
  }

  const cols = products.length + (products.length < MAX_COMPARE ? 1 : 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Comparing <span className="font-semibold text-fg">{products.length}</span> of {MAX_COMPARE} products
        </p>
        <div className="flex items-center gap-4">
          {products.length > 1 && (
            <div className="w-56">
              <Toggle label="Only differences" checked={onlyDiff} onChange={setOnlyDiff} />
            </div>
          )}
          <button type="button" onClick={clearCompare} className="btn btn-ghost btn-sm text-muted">
            <Trash2 className="size-4" aria-hidden="true" /> Clear
          </button>
        </div>
      </div>

      <div className="card -mx-4 overflow-x-auto rounded-none border-x-0 sm:mx-0 sm:rounded-[1.5rem] sm:border-x [scrollbar-width:thin]">
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${8 + cols * 11}rem` }}>
          <caption className="sr-only">Product comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-32 bg-bg-elevated p-3 text-left align-bottom text-xs font-semibold uppercase tracking-wider text-muted sm:w-44 sm:p-4">
                Product
              </th>
              {products.map((p, i) => (
                <th key={p.id} scope="col" className="min-w-[11rem] border-l border-border p-3 text-left align-top font-normal sm:p-4">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="relative">
                    <button
                      type="button"
                      onClick={() => removeCompare(p.id)}
                      className="glass absolute right-1 top-1 z-[2] grid size-9 place-items-center rounded-full transition hover:scale-110 hover:text-rose-400"
                      aria-label={`Remove ${p.name} from comparison`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                    <Link href={p.url} className="block">
                      <span className="relative block aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] light:from-slate-100 light:to-white">
                        <Image src={p.images[0]} alt={(p as { imageAlts?: string[] }).imageAlts?.[0] || p.name} fill sizes="(min-width: 1024px) 18vw, 44vw" className="object-contain p-3" />
                      </span>
                      <span className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">{p.brandName}</span>
                      <span className="mt-0.5 line-clamp-2 block font-semibold leading-snug text-fg hover:underline">{p.name}</span>
                    </Link>
                    {p.priceOnRequest ? (
                      <p className="mt-2 text-sm font-semibold text-fg">Price on request</p>
                    ) : (
                      <Price price={p.price} salePrice={p.salePrice} size="sm" className="mt-2" />
                    )}
                    {p.priceOnRequest ? (
                      <Link href={`/wholesale?product=${p.slug}#quote`} className="btn btn-primary btn-sm mt-3 w-full">
                        Request quote
                      </Link>
                    ) : (
                    <button
                      type="button"
                      disabled={p.stock <= 0}
                      onClick={() => add(p as unknown as CatalogProduct)}
                      className="btn btn-primary btn-sm mt-3 w-full"
                    >
                      <ShoppingBag className="size-4" aria-hidden="true" />
                      {p.stock <= 0 ? "Sold out" : "Add to cart"}
                    </button>
                    )}
                  </motion.div>
                </th>
              ))}
              {products.length < MAX_COMPARE && (
                <td className="min-w-[11rem] border-l border-border p-3 align-top sm:p-4">
                  <Link
                    href="/shop"
                    className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-border-strong text-center text-sm font-semibold text-muted transition-colors hover:border-violet-500/60 hover:text-fg"
                  >
                    <span>
                      <Plus className="mx-auto mb-2 size-6" aria-hidden="true" />
                      Add a product
                    </span>
                  </Link>
                </td>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const diff = products.length > 1 && differs(r);
              return (
                <tr key={r.label} className={cn("border-t border-border", diff && onlyDiff && "bg-violet-500/[0.06]")}>
                  <th scope="row" className="sticky left-0 z-10 bg-bg-elevated p-3 text-left align-top text-xs font-semibold text-muted sm:p-4 sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      {diff && <span className="size-1.5 shrink-0 rounded-full bg-violet-400" title="Differs" aria-label="Differs" />}
                      {r.label}
                    </span>
                  </th>
                  {products.map((p, i) => (
                    <td key={p.id} className="border-l border-border p-3 align-top text-fg sm:p-4">
                      {r.render ? r.render(p, i) : r.values[i] ?? <span className="text-subtle">—</span>}
                    </td>
                  ))}
                  {products.length < MAX_COMPARE && <td className="border-l border-border" />}
                </tr>
              );
            })}
            {onlyDiff && visibleRows.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={cols + 1} className="p-6 text-center text-muted">
                  These products have identical specs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
