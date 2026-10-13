"use client";
import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ListingCtx {
  basePath: string;
  /** Optimistic query string (without "?") – reflects the user's latest choice immediately. */
  search: string;
  params: URLSearchParams;
  pending: boolean;
  /** Mutate the query string. Resets `page` unless `keepPage`. */
  update: (mutate: (p: URLSearchParams) => void, opts?: { keepPage?: boolean; replace?: boolean; scroll?: boolean }) => void;
  /** Read a comma list param */
  getList: (key: string) => string[];
  /** Toggle a value inside a comma list param */
  toggleInList: (key: string, value: string) => void;
}

const Ctx = createContext<ListingCtx | null>(null);

export function useListing() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useListing must be used inside <ListingProvider>");
  return c;
}

/**
 * Holds the listing's URL state. The server passes the current query string, client controls update it optimistically and
 * navigate with router.push inside a transition so the grid can dim while the new results stream in.
 */
export function ListingProvider({ basePath, search, children }: { basePath: string; search: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(search);
  const params = useMemo(() => new URLSearchParams(optimistic), [optimistic]);

  const update = useCallback<ListingCtx["update"]>(
    (mutate, opts = {}) => {
      const next = new URLSearchParams(optimistic);
      mutate(next);
      if (!opts.keepPage) next.delete("page");
      next.sort();
      const qs = next.toString();
      const href = qs ? `${basePath}?${qs}` : basePath;
      startTransition(() => {
        setOptimistic(qs);
        if (opts.replace) router.replace(href, { scroll: opts.scroll ?? false });
        else router.push(href, { scroll: opts.scroll ?? false });
      });
    },
    [optimistic, basePath, router, setOptimistic]
  );

  const getList = useCallback((key: string) => (params.get(key) ?? "").split(",").filter(Boolean), [params]);

  const toggleInList = useCallback(
    (key: string, value: string) =>
      update((p) => {
        const cur = (p.get(key) ?? "").split(",").filter(Boolean);
        const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
        if (next.length) p.set(key, next.join(","));
        else p.delete(key);
      }),
    [update]
  );

  const value = useMemo(
    () => ({ basePath, search: optimistic, params, pending, update, getList, toggleInList }),
    [basePath, optimistic, params, pending, update, getList, toggleInList]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Dims server-rendered results while a filter navigation is in flight. */
export function PendingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useListing();
  return (
    <div
      aria-busy={pending}
      className={cn("relative transition-opacity duration-300", pending && "pointer-events-none opacity-50 saturate-50", className)}
    >
      {pending && (
        <div className="absolute inset-x-0 -top-3 z-10 h-0.5 overflow-hidden rounded-full" aria-hidden="true">
          <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,transparent,#3b82f6,#8b5cf6,transparent)] bg-[length:200%_100%]" />
        </div>
      )}
      {children}
    </div>
  );
}
