import Link from "next/link";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import type { ProductQuery } from "@/lib/types";
import { getBrands, getCategoryAttributes, getCategoryBySlug, queryProducts } from "@/lib/repo/catalog";
import { itemListJsonLd } from "@/lib/seo";
import { WhatsAppLink } from "@/components/content/whatsapp-link";
import { JsonLd } from "@/components/ui/json-ld";
import { ProductGrid } from "@/components/product/product-grid";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { ListingProvider, PendingRegion } from "./listing-context";
import { Filters, type FilterData } from "./filters";
import { ActiveFilters, type FilterLabels } from "./active-filters";
import { SortSelect } from "./sort-select";
import { ViewToggle } from "./view-toggle";
import { MobileFilterBar } from "./mobile-filter-sheet";
import { Pagination } from "./pagination";
import { buildHref, parseListingParams, toRecord, type RawSearchParams } from "./params";

/**
 * Server-rendered product listing with URL-driven filters (sidebar on desktop, bottom sheet on mobile), sort, grid/list
 * view, pagination and ItemList JSON-LD. `base` holds the page's fixed scope (category, brand) and always wins over the URL.
 */
export async function ProductListing({
  basePath,
  searchParams,
  base = {},
  listName,
  keepParams = [],
}: {
  basePath: string;
  searchParams: RawSearchParams;
  base?: Pick<ProductQuery, "categorySlug" | "brand">;
  listName: string;
  /** URL params that "Clear all" must keep (e.g. `q` on /shop) */
  keepParams?: string[];
}) {
  const sp = toRecord(searchParams);
  const { query, view } = parseListingParams(sp);
  const filtered = Object.keys(sp).some((k) => !["view", "sort", "page", ...keepParams].includes(k) && sp[k]);
  const lockBrand = Boolean(base.brand?.length);
  const finalQuery: ProductQuery = { ...query, ...base };

  const category = base.categorySlug ? await getCategoryBySlug(base.categorySlug) : null;
  const [result, brands, attributes] = await Promise.all([
    queryProducts(finalQuery),
    getBrands(),
    category ? getCategoryAttributes(category) : Promise.resolve([]),
  ]);

  const nonNewConditions = result.conditions.filter((c) => c.value !== "new").length > 0;
  const data: FilterData = {
    brands: result.brands,
    conditions: result.conditions,
    facets: result.facets,
    priceRange: result.priceRange,
    showBrand: !lockBrand,
    showCondition: nonNewConditions && result.conditions.length > 1,
  };
  const labels: FilterLabels = {
    brands: Object.fromEntries(brands.map((b) => [b.slug, b.name])),
    attrs: Object.fromEntries([...attributes, ...result.facets].map((a) => [a.key, { label: a.label, unit: a.unit }])),
  };

  // Stable, sorted query string so the client provider's optimistic state matches the server.
  const usp = new URLSearchParams(buildHref("", sp).replace(/^\?/, ""));
  usp.sort();
  const search = usp.toString();

  const from = result.total === 0 ? 0 : (result.page - 1) * (finalQuery.perPage ?? 24) + 1;
  const to = Math.min(result.total, result.page * (finalQuery.perPage ?? 24));
  const clearHref = buildHref(
    basePath,
    Object.fromEntries(keepParams.filter((k) => sp[k]).map((k) => [k, sp[k]]))
  );

  return (
    <ListingProvider basePath={basePath} search={search}>
      {result.items.length > 0 && <JsonLd data={itemListJsonLd(result.items, listName)} />}
      <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-labelledby="filters-heading">
          <div className="card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain px-5 pb-2 pt-5 [scrollbar-width:thin]">
            <h2 id="filters-heading" className="flex items-center gap-2 pb-3 text-base font-bold text-fg">
              <SlidersHorizontal className="size-4 text-violet-400" aria-hidden="true" /> Filters
            </h2>
            <Filters data={data} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {result.total > 0 ? (
                <>
                  Showing <span className="font-semibold text-fg tabular-nums">{from}–{to}</span> of{" "}
                  <span className="font-semibold text-fg tabular-nums">{result.total}</span> product{result.total === 1 ? "" : "s"}
                </>
              ) : (
                "No products found"
              )}
            </p>
            <div className="flex items-center gap-2">
              <SortSelect className="hidden lg:block" />
              <ViewToggle />
            </div>
          </div>
          <div className="mb-5">
            <ActiveFilters labels={labels} keepParams={keepParams} />
          </div>
          {result.approximate && finalQuery.q && (
            <p className="mb-5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted" role="status">
              No exact match for <span className="font-semibold text-fg">“{finalQuery.q}”</span> – showing the closest products.
              {result.didYouMean && (
                <>
                  {" "}Did you mean{" "}
                  <Link href={buildHref(basePath, { q: result.didYouMean })} className="font-semibold text-violet-300 underline-offset-4 hover:underline">
                    {result.didYouMean}
                  </Link>
                  ?
                </>
              )}
            </p>
          )}

          <PendingRegion>
            {result.items.length > 0 ? (
              <>
                {/* keeps the heading order h1 → h2 → product h3 (the filter heading is hidden on phones) */}
                <h2 className="sr-only">Products</h2>
                <ProductGrid products={result.items} layout={view} priorityCount={view === "list" ? 2 : 4} />
              </>
            ) : (
              <EmptyState filtered={filtered} clearHref={clearHref} query={finalQuery.q} didYouMean={result.didYouMean ? buildHref(basePath, { q: result.didYouMean }) : undefined} suggestion={result.didYouMean ?? undefined} />
            )}
          </PendingRegion>

          <Pagination basePath={basePath} searchParams={sp} page={result.page} pages={result.pages} />
        </div>
      </div>
      <MobileFilterBar data={data} total={result.total} />
    </ListingProvider>
  );
}

export function EmptyState({ filtered, clearHref, query, didYouMean, suggestion }: { filtered: boolean; clearHref: string; query?: string; didYouMean?: string; suggestion?: string }) {
  const ask = query ? `Hi! I'm looking for "${query}". Do you have it in stock?` : "Hi! I couldn't find the product I need on your website. Can you help?";
  return (
    <div className="card relative overflow-hidden px-6 py-14 text-center sm:py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
      <span className="relative mx-auto grid size-16 place-items-center rounded-3xl bg-surface-strong">
        <PackageSearch className="size-8 text-violet-400" aria-hidden="true" />
      </span>
      <h2 className="relative mt-5 text-xl font-bold text-fg sm:text-2xl">
        {query && !filtered ? `No results for “${query}”` : filtered ? "No products match these filters" : "Nothing here yet"}
      </h2>
      {didYouMean && suggestion && (
        <p className="relative mt-2 text-base text-fg">
          Did you mean{" "}
          <Link href={didYouMean} className="font-semibold text-violet-300 underline-offset-4 hover:underline">
            {suggestion}
          </Link>
          ?
        </p>
      )}
      <p className="relative mx-auto mt-2 max-w-md text-sm text-muted sm:text-base">
        New stock lands every week at our Saddar store – and much of it sells before it&apos;s listed. Message us on WhatsApp and we&apos;ll check
        availability for you.
      </p>
      <div className="relative mt-6 flex flex-wrap justify-center gap-3">
        {filtered && (
          <Link href={clearHref} className="btn btn-secondary">
            Clear filters
          </Link>
        )}
        <WhatsAppLink message={ask} className="btn btn-whatsapp">
          <WhatsAppIcon className="size-4" /> Ask on WhatsApp
        </WhatsAppLink>
      </div>
    </div>
  );
}
