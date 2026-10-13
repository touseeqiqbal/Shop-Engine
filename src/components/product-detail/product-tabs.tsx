"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { m as motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabSection {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Accessible tabs on desktop (lg+), accordions on mobile.
 * Every panel is server-rendered once into the DOM (good for SEO) – only visibility changes.
 */
export function ProductTabs({ sections }: { sections: TabSection[] }) {
  const uid = useId();
  const [active, setActive] = useState(sections[0]?.id);
  const [open, setOpen] = useState<Record<string, boolean>>({ [sections[0]?.id ?? ""]: true });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % sections.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + sections.length) % sections.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sections.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(sections[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Product information" className="mb-6 hidden gap-1 rounded-full border border-border bg-surface p-1.5 lg:inline-flex">
        {sections.map((s, i) => {
          const selected = s.id === active;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${uid}-tab-${s.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${uid}-panel-${s.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(s.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                selected ? "text-white" : "text-muted hover:text-fg"
              )}
            >
              {selected && (
                <motion.span layoutId={`${uid}-pill`} className="absolute inset-0 rounded-full bg-brand-gradient" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
              )}
              <span className="relative">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-bg-elevated lg:divide-y-0 lg:border-0 lg:bg-transparent">
        {sections.map((s) => {
          const isOpen = !!open[s.id];
          return (
            <section key={s.id} aria-labelledby={`${uid}-acc-${s.id}`}>
              <h2 className="lg:hidden">
                <button
                  id={`${uid}-acc-${s.id}`}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${uid}-panel-${s.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-4 text-left font-display text-base font-bold text-fg"
                >
                  {s.label}
                  <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform duration-300", isOpen && "rotate-180")} aria-hidden="true" />
                </button>
              </h2>
              <div
                id={`${uid}-panel-${s.id}`}
                role="tabpanel"
                aria-labelledby={`${uid}-tab-${s.id}`}
                tabIndex={0}
                className={cn(
                  "px-5 pb-6 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:rounded-[1.75rem] lg:border lg:border-border lg:bg-surface lg:p-8",
                  isOpen ? "block" : "hidden",
                  s.id === active ? "lg:block" : "lg:hidden"
                )}
              >
                {s.content}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
