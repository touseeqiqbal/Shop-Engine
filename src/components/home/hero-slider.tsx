"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStoreLocale } from "@/components/providers/locale";
import { AnimatePresence, m as motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, Truck, Wallet } from "lucide-react";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTERVAL = 6000;

/** `cod`: the store offers Cash on Delivery (only then is it listed under the slide). */
export function HeroSlider({ slides, cod }: { slides: Banner[]; cod: boolean }) {
  const pk = useStoreLocale().country === "PK";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // The first slide is server-rendered fully visible (fast LCP); only later slide changes animate in.
  const [changed, setChanged] = useState(false);
  const reduce = useReducedMotion();
  // rotation starts only once the page has loaded and the browser is idle, and stops while the tab is hidden
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const count = slides.length;
  const go = useCallback(
    (i: number) => {
      setChanged(true);
      setIndex(((i % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    let idle = 0;
    const start = () => {
      const ric = (window as Partial<Window>).requestIdleCallback;
      idle = ric ? ric(() => setReady(true), { timeout: 4000 }) : window.setTimeout(() => setReady(true), 2000);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("load", start);
      document.removeEventListener("visibilitychange", onVisibility);
      (window as Partial<Window>).cancelIdleCallback?.(idle);
      window.clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    if (!ready || hidden || paused || reduce || count < 2) return;
    // The first rotation waits longer so the initial slide stays the page's LCP element during load.
    const t = setTimeout(() => go(index + 1), changed ? INTERVAL : INTERVAL * 2);
    return () => clearTimeout(t);
  }, [index, ready, hidden, paused, reduce, count, go, changed]);

  if (!count) return null;
  const s = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* ambient gradient */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div
        className={cn("pointer-events-none absolute -right-24 -top-24 size-[32rem] rounded-full bg-gradient-to-br opacity-30 blur-3xl transition-all duration-700", s.accent ?? "from-blue-500 to-violet-500")}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-blue-600/20 blur-3xl" aria-hidden="true" />

      <motion.div
        className="relative grid items-center gap-2 px-5 pb-20 pt-6 sm:px-10 sm:pt-10 md:min-h-[28rem] md:grid-cols-2 lg:min-h-[32rem] lg:px-14"
        drag={count > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) go(index + 1);
          else if (info.offset.x > 60) go(index - 1);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={s.id}
            initial={reduce || !changed ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 order-2 md:order-1"
            aria-live="polite"
          >
            {s.eyebrow && <p className="chip mb-4 border-violet-500/40 bg-violet-500/10 text-violet-300 light:text-violet-700">{s.eyebrow}</p>}
            <h2 className="text-[2rem] font-bold leading-[1.05] text-fg sm:text-5xl lg:text-6xl">{s.title}</h2>
            <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">{s.subtitle}</p>
            <div className="mt-6 flex gap-3 sm:mt-7">
              <Link href={s.ctaHref} className="btn btn-primary sm:min-h-[3.25rem] sm:px-7">
                {s.ctaLabel} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/shop" className="btn btn-secondary sm:min-h-[3.25rem] sm:px-7">
                Browse all
              </Link>
            </div>
            <ul className="mt-7 hidden flex-wrap gap-x-5 gap-y-2 text-sm text-muted sm:flex">
              {cod && <li className="flex items-center gap-1.5"><Wallet className="size-4 text-emerald-400" aria-hidden="true" /> Cash on Delivery</li>}
              <li className="flex items-center gap-1.5"><Truck className="size-4 text-sky-400" aria-hidden="true" /> {pk ? "All over Pakistan" : "Nationwide delivery"}</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-violet-400" aria-hidden="true" /> Warranty</li>
            </ul>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`img-${s.id}`}
            initial={reduce || !changed ? false : { opacity: 0, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative order-1 mx-auto aspect-square w-full max-w-[13rem] sm:max-w-[18rem] md:order-2 md:max-w-[30rem]"
          >
            <div className="animate-float relative size-full">
              <Image src={s.image} alt="" fill priority={index === 0} sizes="(min-width: 768px) 480px, 288px" className="object-contain drop-shadow-[0_30px_60px_rgba(99,102,241,0.35)]" />
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-between px-6 sm:px-10 lg:px-14">
          <div className="flex gap-2" role="tablist" aria-label="Choose slide">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}: ${b.title}`}
                onClick={() => go(i)}
                className="relative h-1.5 w-8 overflow-hidden rounded-full bg-surface-strong sm:w-12"
              >
                {i === index && (
                  <motion.span
                    key={`${index}-${paused}`}
                    className="absolute inset-y-0 left-0 bg-brand-gradient"
                    initial={{ width: paused || reduce ? "100%" : "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: paused || reduce ? 0 : (changed ? INTERVAL : INTERVAL * 2) / 1000, ease: "linear" }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(index - 1)} className="glass grid size-10 place-items-center rounded-full" aria-label="Previous slide">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(index + 1)} className="glass grid size-10 place-items-center rounded-full" aria-label="Next slide">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
