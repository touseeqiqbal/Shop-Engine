import { BadgeCheck, MapPin, MessageSquareText } from "lucide-react";
import type { CatalogProduct, Review } from "@/lib/types";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getDateFormatter } from "@/lib/store-locale";
import { Stars } from "@/components/ui/stars";
import { ReviewForm } from "./review-form";

export function reviewStats(product: CatalogProduct, reviews: Review[]) {
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : product.rating;
  const count = Math.max(product.reviewCount, reviews.length);
  return { average: Math.round(average * 10) / 10, count };
}

export async function ReviewsSection({ product, reviews }: { product: CatalogProduct; reviews: Review[] }) {
  const site = await getSiteInfo(); // the current store's own name
  const date = await getDateFormatter(); // the store's language and time zone
  const { average, count } = reviewStats(product, reviews);
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => Math.round(r.rating) === star).length }));
  const max = Math.max(1, reviews.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:gap-10">
      <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="card p-6">
          <div className="flex items-end gap-3">
            <p className="font-display text-5xl font-bold leading-none text-fg">{count ? average.toFixed(1) : "–"}</p>
            <div className="pb-1">
              <Stars rating={count ? average : 0} size="md" />
              <p className="mt-1 text-xs text-muted">
                {count ? `Based on ${count} review${count === 1 ? "" : "s"}` : "No reviews yet"}
              </p>
            </div>
          </div>
          <ul className="mt-5 space-y-2" aria-label="Rating distribution">
            {dist.map(({ star, n }) => (
              <li key={star} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 tabular-nums text-muted">{star} ★</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums text-muted">
                  {n}
                  <span className="sr-only"> {n === 1 ? "review" : "reviews"} with {star} stars</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <ReviewForm productId={product.id} productName={product.name} />
      </div>

      <div>
        {reviews.length ? (
          <ul className="space-y-3">
            {reviews.slice(0, 20).map((r) => (
              <li key={r.id}>
                <article className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white" aria-hidden="true">
                        {r.name
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div>
                        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-fg">
                          {r.name}
                          {r.verified && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                              <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified buyer
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-muted">
                          {r.city && (
                            <>
                              <MapPin className="size-3" aria-hidden="true" /> {r.city} ·{" "}
                            </>
                          )}
                          <time dateTime={r.createdAt}>{date(r.createdAt)}</time>
                        </p>
                      </div>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  {r.title && <h3 className="mt-4 font-semibold text-fg">{r.title}</h3>}
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-fg/85">{r.body}</p>
                  {r.photos && r.photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.photos.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block size-20 overflow-hidden rounded-xl border border-border bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Photo from ${r.name}`} loading="lazy" className="size-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card grid place-items-center gap-3 p-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-surface-strong">
              <MessageSquareText className="size-6 text-violet-400" aria-hidden="true" />
            </span>
            <p className="font-semibold text-fg">Be the first to review this product</p>
            <p className="max-w-sm text-sm text-muted">Bought this from {site.name}? Tell other shoppers how it&apos;s working for you.</p>
          </div>
        )}
      </div>
    </div>
  );
}
