import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="container-x pb-16 pt-4 sm:pt-6" role="status" aria-label="Loading product">
      <Skeleton className="mb-6 h-4 w-64 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-[1.75rem]" />
          <div className="hidden gap-2.5 sm:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-20 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-56 w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-13 rounded-full" />
            <Skeleton className="h-13 rounded-full" />
          </div>
          <Skeleton className="h-13 w-full rounded-full" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Loading product…</span>
    </div>
  );
}
