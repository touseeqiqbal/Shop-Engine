"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { ArrowRight, Search, TrendingUp, X } from "lucide-react";
import { useUi } from "@/store/ui";
import { usePrefs } from "@/components/providers/preferences";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPKR } from "@/lib/utils";
import { trackEvent } from "@/components/analytics";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export interface SearchHit {
  name: string;
  url: string;
  image: string;
  price: number;
  priceOnRequest?: boolean;
  brandName: string;
  categoryName: string;
}
interface SearchResponse {
  products: SearchHit[];
  categories: { name: string; slug: string }[];
  didYouMean?: string | null;
}

const POPULAR = ["HP EliteBook", "Dell charger", "Gaming mouse", "Mechanical keyboard", "NVMe SSD", "Laptop battery", "MacBook"];

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useUi();
  const { t } = usePrefs();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, searchOpen);
  const listId = useId();

  useEffect(() => {
    if (!searchOpen) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setData(await res.json());
        setActive(-1);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const close = () => setSearchOpen(false);
  const submit = (term = q) => {
    if (!term.trim()) return;
    close();
    trackEvent("search", { search_term: term.trim() });
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  };
  const hits = data?.products ?? [];

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-3 pt-3 backdrop-blur-sm sm:pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border-strong bg-bg-elevated shadow-2xl"
          >
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (active >= 0 && hits[active]) {
                  close();
                  router.push(hits[active].url);
                } else submit();
              }}
              className="flex items-center gap-3 border-b border-border px-4"
            >
              <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
                }}
                placeholder={t("searchPlaceholder")}
                className="h-16 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
                aria-label="Search"
                role="combobox"
                aria-expanded={hits.length > 0}
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
              />
              <button type="button" onClick={close} className="btn btn-ghost btn-icon" aria-label="Close search">
                <X className="size-5" aria-hidden="true" />
              </button>
            </form>

            <div className="max-h-[70vh] overflow-y-auto p-3">
              {q.trim().length < 2 ? (
                <div className="p-2">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    <TrendingUp className="size-4" aria-hidden="true" /> Popular searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR.map((p) => (
                      <button key={p} type="button" onClick={() => setQ(p)} className="chip hover:border-violet-500/60">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : loading && !data ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="size-14 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {!!data?.categories.length && (
                    <div className="mb-2 flex flex-wrap gap-2 px-2 pt-1">
                      {data.categories.map((c) => (
                        <Link key={c.slug} href={`/category/${c.slug}`} onClick={close} className="chip hover:border-violet-500/60">
                          in {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  <ul id={listId} role="listbox" aria-label="Suggestions">
                    {hits.map((h, i) => (
                      <li key={h.url} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                        <Link
                          href={h.url}
                          onClick={close}
                          className={`flex items-center gap-3 rounded-2xl p-2 transition ${i === active ? "bg-surface-strong" : "hover:bg-surface"}`}
                        >
                          <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                            <Image src={h.image} alt="" fill sizes="56px" className="object-contain p-1" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-sm font-medium text-fg">{h.name}</span>
                            <span className="text-xs text-muted">
                              {h.brandName} · {h.categoryName}
                            </span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-fg">{h.priceOnRequest ? "On request" : formatPKR(h.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {data && hits.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted">
                      No products found for “{q}”.{" "}
                      {data.didYouMean && (
                        <>
                          Did you mean{" "}
                          <button type="button" onClick={() => setQ(data.didYouMean!)} className="font-semibold text-violet-400 underline">
                            {data.didYouMean}
                          </button>
                          ?{" "}
                        </>
                      )}
                      Try another term or{" "}
                      <Link href="/contact" onClick={close} className="text-violet-400 underline">
                        ask us on WhatsApp
                      </Link>
                      .
                    </p>
                  )}
                  {hits.length > 0 && (
                    <button type="button" onClick={() => submit()} className="btn btn-secondary mt-2 w-full">
                      See all results for “{q}” <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
