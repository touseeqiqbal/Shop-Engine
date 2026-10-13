/**
 * Listing URL scheme (shared by /category/[slug], /shop, /brands/[slug]). Pure & server-safe – also used on the client.
 *
 *   brand=hp,dell            brand slugs (comma separated)
 *   condition=used-a-plus    Condition values (comma separated)
 *   min=50000&max=150000     effective PKR price bounds
 *   stock=1                  in-stock only
 *   sort=price-asc           relevance (default while searching) | popular (default) | newest | price-asc | price-desc | rating
 *   page=2                   1-based page, 24 products per page
 *   view=list                grid (default) | list
 *   q=elitebook              free-text search (/shop only)
 *   a_{key}=v1,v2            select / boolean category attributes (booleans as a_touch=true)
 *   r_{key}=min-max          range category attributes, e.g. r_dpi=800-16000
 *
 * Any param other than `view` (and `q` on /shop) changes the result set, so those pages are
 * canonicalised to the clean URL and marked noindex,follow.
 */
import type { Condition, ProductQuery, SortKey } from "@/lib/types";

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type ListingView = "grid" | "list";

export const PER_PAGE = 24;

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest arrivals" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((s) => s.value));
const CONDITIONS = new Set<string>(["new", "used-a-plus", "used-a", "refurbished", "open-box"]);

/** Params that never change which products are listed. */
const PRESENTATION_PARAMS = new Set(["view"]);

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function list(v: string | string[] | undefined): string[] {
  const s = first(v);
  if (!s) return [];
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 30);
}

function num(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/** Normalises URLSearchParams / Next searchParams into a plain record. */
export function toRecord(sp: RawSearchParams | URLSearchParams | string): RawSearchParams {
  if (typeof sp === "string" || sp instanceof URLSearchParams) {
    const usp = typeof sp === "string" ? new URLSearchParams(sp) : sp;
    const out: RawSearchParams = {};
    for (const [k, v] of usp.entries()) if (out[k] === undefined) out[k] = v;
    return out;
  }
  return sp;
}

export interface ParsedListing {
  query: ProductQuery;
  view: ListingView;
  /** true when anything other than presentation params is set */
  filtered: boolean;
}

/** searchParams → ProductQuery (+ view). Unknown / malformed values are dropped silently. */
export function parseListingParams(input: RawSearchParams | URLSearchParams | string): ParsedListing {
  const sp = toRecord(input);
  const query: ProductQuery = { perPage: PER_PAGE };

  const brand = list(sp.brand);
  if (brand.length) query.brand = brand;

  const condition = list(sp.condition).filter((c) => CONDITIONS.has(c)) as Condition[];
  if (condition.length) query.condition = condition;

  const min = num(sp.min);
  const max = num(sp.max);
  if (min != null) query.minPrice = min;
  if (max != null) query.maxPrice = max;
  if (min != null && max != null && min > max) [query.minPrice, query.maxPrice] = [max, min];

  if (first(sp.stock) === "1") query.inStock = true;

  const sort = first(sp.sort);
  if (sort && SORT_KEYS.has(sort)) query.sort = sort as SortKey;

  const page = num(sp.page);
  if (page && page > 1) query.page = page;

  const q = first(sp.q)?.trim().slice(0, 80);
  if (q) query.q = q;

  const attrs: Record<string, string[]> = {};
  const ranges: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("a_") && k.length > 2) {
      const vals = list(v);
      if (vals.length) attrs[k.slice(2)] = vals;
    } else if (k.startsWith("r_") && k.length > 2) {
      const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(first(v) ?? "");
      if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        ranges[k.slice(2)] = a <= b ? [a, b] : [b, a];
      }
    }
  }
  if (Object.keys(attrs).length) query.attrs = attrs;
  if (Object.keys(ranges).length) query.ranges = ranges;

  const view: ListingView = first(sp.view) === "list" ? "list" : "grid";
  const filtered = Object.entries(sp).some(([k, v]) => !PRESENTATION_PARAMS.has(k) && first(v) != null && first(v) !== "");

  return { query, view, filtered };
}

/** True when the URL carries anything that should keep the page out of the index. */
export function shouldNoindex(sp: RawSearchParams) {
  return parseListingParams(sp).filtered;
}

/** Build an href for `basePath` from a record, dropping empty values. */
export function buildHref(basePath: string, params: RawSearchParams | URLSearchParams, changes: Record<string, string | null> = {}) {
  const usp = new URLSearchParams();
  const rec = toRecord(params);
  for (const [k, v] of Object.entries(rec)) {
    const s = first(v);
    if (s != null && s !== "") usp.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === "") usp.delete(k);
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
