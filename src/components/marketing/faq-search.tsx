"use client";
import { useId, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { Faq } from "@/lib/marketing/content";

/** The FAQ page: search box and topic filter over every question (all answers stay in the HTML for search engines). */
export function FaqSearch({ items }: { items: Faq[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Faq["group"] | "All">("All");
  const inputId = useId();
  const groups = useMemo(() => ["All", ...Array.from(new Set(items.map((f) => f.group)))] as const, [items]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((f) => (group === "All" || f.group === group) && words.every((w) => `${f.q} ${f.a}`.toLowerCase().includes(w)));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search the questions
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, e.g. “domain”, “trial” or “cash on delivery”"
          autoComplete="off"
          className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pl-12 pr-12 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-faint transition-colors hover:border-white/20 focus:border-brand focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-brand-100 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-white/10 hover:text-white" aria-label="Clear the search">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter by topic" className="mt-5 flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${group === g ? "border-white bg-white text-[#050820]" : "border-white/10 bg-white/[0.04] text-ink-2 hover:border-white/20 hover:text-white"}`}
          >
            {g}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? "question" : "questions"} shown
      </p>

      <div className="mt-8 space-y-3">
        {items.map((f) => (
          <details key={f.q} className="mk-card group overflow-hidden !rounded-2xl transition-colors open:border-white/15 open:bg-white/[0.035]" hidden={!shown.includes(f)}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[0.975rem] font-medium text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-transform duration-300 group-open:rotate-45">
                <Plus className="size-3.5 text-ink-2" aria-hidden="true" />
              </span>
            </summary>
            <p className="px-5 pb-5 pr-12 text-[0.9375rem] leading-relaxed text-body sm:px-6">{f.a}</p>
          </details>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-white/15 p-6 text-center text-body">
          No questions match “{q}”.{" "}
          <button
            type="button"
            className="mk-link"
            onClick={() => {
              setQ("");
              setGroup("All");
            }}
          >
            Show all questions
          </button>
        </p>
      )}
    </div>
  );
}
