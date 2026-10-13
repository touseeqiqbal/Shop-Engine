import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Skeleton, ProductGridSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Header block for discovery pages: breadcrumbs, eyebrow, the page's single H1, intro copy and an optional aside. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  description,
  icon,
  aside,
  children,
  className,
}: {
  crumbs: Crumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative pb-6 pt-4 sm:pb-8 sm:pt-6", className)}>
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[min(60rem,100%)] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/15 via-violet-600/20 to-fuchsia-600/10 blur-3xl" aria-hidden="true" />
      <Breadcrumbs items={crumbs} />
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_40px_-12px_rgba(139,92,246,0.8)] sm:grid">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] gradient-text">{eyebrow}</p>}
            <h1 className="text-[1.75rem] font-bold leading-tight text-fg sm:text-4xl lg:text-[2.75rem]">{title}</h1>
            {description && <div className="mt-2 max-w-3xl text-sm text-muted sm:text-base">{description}</div>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </header>
  );
}

/** Skeleton matching PageHero + ProductListing – used by loading.tsx files. */
export function ListingSkeleton({ withFilters = true }: { withFilters?: boolean }) {
  return (
    <div className="container-x pb-16">
      <div className="pb-8 pt-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-3 w-24" />
        <Skeleton className="mt-3 h-10 w-full max-w-md" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className={cn(withFilters && "lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]")}>
        {withFilters && (
          <div className="card hidden space-y-5 p-5 lg:block" aria-hidden="true">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
