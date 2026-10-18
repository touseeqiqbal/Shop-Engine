import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildHref, type RawSearchParams } from "./params";

/** First, last and the pages `spread` either side of the current one; "…" for the gaps. */
function pageList(page: number, pages: number, spread: number): (number | "…")[] {
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= spread) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return nums;
}

/** Crawlable numbered pagination (real <a> links). Page 1 has no `page` param. */
export function Pagination({ basePath, searchParams, page, pages }: { basePath: string; searchParams: RawSearchParams; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => buildHref(basePath, searchParams, { page: n > 1 ? String(n) : null });

  const base = "grid min-w-11 h-11 place-items-center rounded-full px-3 text-sm font-semibold tabular-nums transition-colors";
  // phones get first · current · last (fits 320 px with the 44 px arrows); wider screens also the pages either side
  const list = (nums: (number | "…")[], className: string) => (
    <ol className={cn("items-center gap-1.5", className)}>
      {nums.map((n, i) =>
        n === "…" ? (
          <li key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
            …
          </li>
        ) : (
          <li key={n}>
            {n === page ? (
              <span aria-current="page" className={cn(base, "bg-brand-gradient text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]")}>
                {n}
              </span>
            ) : (
              <Link href={href(n)} className={cn(base, "text-muted hover:bg-surface-strong hover:text-fg")} aria-label={`Page ${n}`}>
                {n}
              </Link>
            )}
          </li>
        )
      )}
    </ol>
  );

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={cn(base, "border border-border bg-surface hover:border-violet-500/50")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(base, "border border-border opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      {list(pageList(page, pages, 0), "flex sm:hidden")}
      {list(pageList(page, pages, 1), "hidden sm:flex")}
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={cn(base, "border border-border bg-surface hover:border-violet-500/50")} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(base, "border border-border opacity-40")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
