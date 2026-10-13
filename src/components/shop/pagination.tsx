import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildHref, type RawSearchParams } from "./params";

/** Crawlable numbered pagination (real <a> links). Page 1 has no `page` param. */
export function Pagination({ basePath, searchParams, page, pages }: { basePath: string; searchParams: RawSearchParams; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => buildHref(basePath, searchParams, { page: n > 1 ? String(n) : null });

  const nums: (number | "…")[] = [];
  const around = new Set([1, pages, page - 1, page, page + 1]);
  for (let i = 1; i <= pages; i++) {
    if (around.has(i)) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  const base = "grid min-w-11 h-11 place-items-center rounded-full px-3 text-sm font-semibold tabular-nums transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={cn(base, "border border-border bg-surface hover:border-violet-500/50")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(base, "border border-border opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      <ol className="flex items-center gap-1.5">
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
