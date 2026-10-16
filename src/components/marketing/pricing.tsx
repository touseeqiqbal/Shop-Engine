"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import type { PlanCard } from "@/lib/marketing/plans";
import { ALL_FEATURES, FEATURE_LABEL } from "@/lib/marketing/plan-features";
import { SITE } from "@/lib/marketing/content";

/** The plan cards with a monthly / yearly switch (yearly only when the plans have yearly prices). */
export function PricingCards({ plans }: { plans: PlanCard[] }) {
  const shown = plans.slice(0, 4);
  const hasYearly = shown.some((p) => p.annualPrice);
  const bestSaving = Math.max(0, ...shown.map((p) => p.annualSaving ?? 0));
  const [yearly, setYearly] = useState(false);
  return (
    <div className="mk-reveal mt-14">
      {hasYearly && (
        <div className="flex justify-center">
          <div role="group" aria-label="Billing period" className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {[
              { v: false, l: "Monthly" },
              { v: true, l: "Yearly" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                aria-pressed={yearly === o.v}
                onClick={() => setYearly(o.v)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${yearly === o.v ? "bg-white text-[#050820] shadow" : "text-ink-2 hover:text-white"}`}
              >
                {o.l}
                {o.v && bestSaving > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${yearly ? "bg-[#050820] text-white" : "bg-ok-50 text-ok"}`}>save up to {bestSaving}%</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`mt-10 grid gap-4 md:grid-cols-2 ${shown.length >= 3 ? "lg:grid-cols-3" : ""} ${shown.length === 4 ? "xl:grid-cols-4" : ""}`}>
        {shown.map((p) => {
          const showYear = yearly && p.annualPrice;
          return (
            <article key={p.key} className={`mk-card relative flex flex-col p-7 ${p.recommended ? "mk-glow-edge bg-[radial-gradient(90%_60%_at_50%_0%,rgba(116,102,255,0.18),transparent_70%)] shadow-[0_30px_100px_-30px_rgba(116,102,255,0.7)] lg:-translate-y-3" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-ink">{p.name}</h3>
                {p.recommended && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#3d86ff] to-[#a173ff] px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Sparkles className="size-3" aria-hidden="true" /> Recommended
                  </span>
                )}
              </div>
              <p className="mt-2 min-h-[2.5rem] text-sm leading-snug text-faint">{p.audience}</p>
              <p className="mt-6 flex items-baseline gap-2">
                {p.price ? (
                  <>
                    <span className="text-[2.6rem] font-semibold leading-none tracking-[-0.04em] text-white">{showYear ? p.annualPrice : p.price}</span>
                    <span className="text-sm text-faint">{showYear ? "per store / year" : p.priceNote}</span>
                  </>
                ) : (
                  <span className="text-lg font-medium text-ink-2">{p.priceNote}</span>
                )}
              </p>
              <p className="mt-2 min-h-[1.25rem] text-xs text-faint">
                {[p.trial, showYear ? (p.annualSaving ? `${p.annualSaving}% less than monthly` : null) : p.annual].filter(Boolean).join(" · ")}
                {yearly && p.price && !p.annualPrice ? "Billed monthly" : ""}
              </p>
              <Link href={SITE.signUp} className={`mk-btn mt-6 w-full ${p.recommended ? "mk-btn-primary" : "mk-btn-secondary"}`}>
                {p.trial ? "Start free trial" : "Get started"} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <div className="mk-divider my-7" />
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2.5 text-ink-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                  {p.products}
                </li>
                <li className="flex gap-2.5 text-ink-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                  {p.team}
                </li>
                {p.configured
                  ? ALL_FEATURES.map((f) => {
                      const on = p.features.includes(f);
                      return (
                        <li key={f} className={`flex gap-2.5 ${on ? "text-ink-2" : "text-faint/70"}`}>
                          {on ? <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" /> : <Minus className="mt-0.5 size-4 shrink-0 text-white/20" aria-hidden="true" />}
                          <span>
                            {FEATURE_LABEL[f]}
                            {!on && <span className="sr-only"> (not included)</span>}
                          </span>
                        </li>
                      );
                    })
                  : ["Custom domain, card payments and POS depend on the plan"].map((t) => (
                      <li key={t} className="flex gap-2.5 text-faint">
                        <Minus className="mt-0.5 size-4 shrink-0 text-white/20" aria-hidden="true" />
                        {t}
                      </li>
                    ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
