"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m as motion, useDragControls, useReducedMotion } from "framer-motion";
import { ArrowUpDown, Check, Loader, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListing } from "./listing-context";
import { Filters, type FilterData } from "./filters";
import { useActiveFilterCount } from "./active-filters";
import { SORT_OPTIONS } from "./params";

/**
 * Mobile-only floating "Filters | Sort" pill (sits above the 64px BottomNav and left of the WhatsApp button)
 * that opens bottom-sheet drawers. Filters apply live; "Show results" just closes the sheet.
 */
export function MobileFilterBar({ data, total, hasFilters = true }: { data: FilterData; total: number; hasFilters?: boolean }) {
  const [open, setOpen] = useState<"filters" | "sort" | null>(null);
  const { params, update, pending } = useListing();
  const count = useActiveFilterCount();
  const searching = Boolean(params.get("q"));
  const sortDefault = searching ? "relevance" : "popular";
  const sort = params.get("sort") ?? sortDefault;

  const clearAll = () =>
    update((p) => {
      for (const k of [...p.keys()]) if (!["sort", "view", "q"].includes(k)) p.delete(k);
    });

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-20 lg:hidden">
        <div className="glass pointer-events-auto flex items-center rounded-full p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]">
          {hasFilters && (
            <>
              <button
                type="button"
                onClick={() => setOpen("filters")}
                className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-fg active:bg-surface-strong"
                aria-haspopup="dialog"
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
                {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">{count}</span>}
              </button>
              <span className="h-6 w-px bg-border-strong" aria-hidden="true" />
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen("sort")}
            className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-fg active:bg-surface-strong"
            aria-haspopup="dialog"
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
            Sort
          </button>
        </div>
      </div>

      <BottomSheet open={open === "filters"} onClose={() => setOpen(null)} title="Filters">
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          <Filters data={data} />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={count === 0}>
            Clear all
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(null)}>
            {pending ? <Loader className="size-4 animate-spin" aria-hidden="true" /> : null}
            Show {total} result{total === 1 ? "" : "s"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={open === "sort"} onClose={() => setOpen(null)} title="Sort by">
        <ul className="px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" role="radiogroup" aria-label="Sort by">
          {SORT_OPTIONS.filter((o) => searching || o.value !== "relevance").map((o) => {
            const active = sort === o.value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    update((p) => (o.value === sortDefault ? p.delete("sort") : p.set("sort", o.value)));
                    setOpen(null);
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between rounded-2xl px-4 text-left text-[0.95rem] transition-colors",
                    active ? "bg-surface-strong font-semibold text-fg" : "text-fg/85 active:bg-surface"
                  )}
                >
                  {o.label}
                  {active && <Check className="size-5 text-violet-400" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select")].filter(
          (el) => el.offsetParent !== null
        );
        if (!els.length) return;
        const firstEl = els[0];
        const lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] border border-b-0 border-border-strong bg-bg-elevated shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)]"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controls}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <SheetHandle title={title} onClose={onClose} onPointerDown={(e) => controls.start(e)} />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SheetHandle({ title, onClose, onPointerDown }: { title: string; onClose: () => void; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div className="shrink-0 touch-none px-5 pb-2 pt-3" onPointerDown={onPointerDown}>
      <div className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" aria-hidden="true" />
      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-icon -mr-2" aria-label={`Close ${title.toLowerCase()}`}>
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
