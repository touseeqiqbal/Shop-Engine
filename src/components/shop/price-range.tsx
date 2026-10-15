"use client";
import { useEffect, useRef, useState } from "react";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { cn } from "@/lib/utils";

const thumb =
  "pointer-events-none absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:outline-none " +
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-[0_4px_14px_rgba(139,92,246,0.6)] [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-110 " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-violet-500 " +
  "[&:focus-visible::-webkit-slider-thumb]:ring-4 [&:focus-visible::-webkit-slider-thumb]:ring-violet-500/40 [&:focus-visible::-moz-range-thumb]:ring-4";

/**
 * Accessible dual-thumb range: two native range inputs (keyboard / screen-reader friendly) sharing one track, plus
 * numeric inputs. Slider moves commit after a short pause; typed values commit on blur / Enter.
 * `onCommit(null)` means "no restriction" (full range selected).
 */
export function RangeSlider({
  id,
  label,
  min,
  max,
  value,
  step,
  unit,
  currency,
  onCommit,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value?: [number, number] | null;
  step?: number;
  unit?: string;
  currency?: boolean;
  onCommit: (v: [number, number] | null) => void;
}) {
  const s = step ?? autoStep(min, max);
  const lo0 = clamp(value?.[0] ?? min, min, max);
  const hi0 = clamp(value?.[1] ?? max, min, max);
  const [lo, setLo] = useState(lo0);
  const [hi, setHi] = useState(hi0);
  const [loText, setLoText] = useState(String(lo0));
  const [hiText, setHiText] = useState(String(hi0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const money = useMoney();
  const { locale } = useStoreLocale();

  // Sync when the URL (props) changes from elsewhere, e.g. "Clear all".
  useEffect(() => {
    setLo(lo0);
    setHi(hi0);
    setLoText(String(lo0));
    setHiText(String(hi0));
  }, [lo0, hi0]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const commit = (a: number, b: number) => {
    if (timer.current) clearTimeout(timer.current);
    if (a === lo0 && b === hi0) return;
    onCommit(a <= min && b >= max ? null : [a, b]);
  };
  const schedule = (a: number, b: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(a, b), 550);
  };

  const fmt = (n: number) => (currency ? money(n) : `${n.toLocaleString(locale)}${unit ? ` ${unit}` : ""}`);
  const span = Math.max(1, max - min);
  const left = ((lo - min) / span) * 100;
  const right = 100 - ((hi - min) / span) * 100;

  const commitText = () => {
    let a = clamp(Number(loText) || min, min, max);
    let b = clamp(Number(hiText) || max, min, max);
    if (a > b) [a, b] = [b, a];
    setLo(a);
    setHi(b);
    setLoText(String(a));
    setHiText(String(b));
    commit(a, b);
  };

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums text-fg">
        <span>{fmt(lo)}</span>
        <span>{fmt(hi)}</span>
      </div>
      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-strong" aria-hidden="true" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-gradient"
          style={{ left: `${left}%`, right: `${right}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          className={cn(thumb, lo > max - span * 0.1 && "z-[2]")}
          min={min}
          max={max}
          step={s}
          value={lo}
          aria-label={`Minimum ${label.toLowerCase()}`}
          aria-valuetext={fmt(lo)}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            setLo(v);
            setLoText(String(v));
            schedule(v, hi);
          }}
        />
        <input
          type="range"
          className={thumb}
          min={min}
          max={max}
          step={s}
          value={hi}
          aria-label={`Maximum ${label.toLowerCase()}`}
          aria-valuetext={fmt(hi)}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            setHi(v);
            setHiText(String(v));
            schedule(lo, v);
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <label className="sr-only" htmlFor={`${id}-min`}>
          Minimum {label.toLowerCase()}
        </label>
        <input
          id={`${id}-min`}
          inputMode="numeric"
          className="input !min-h-10 !rounded-xl !px-3 !py-1.5 text-sm tabular-nums"
          value={loText}
          onChange={(e) => setLoText(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitText())}
        />
        <span className="text-xs text-subtle" aria-hidden="true">
          to
        </span>
        <label className="sr-only" htmlFor={`${id}-max`}>
          Maximum {label.toLowerCase()}
        </label>
        <input
          id={`${id}-max`}
          inputMode="numeric"
          className="input !min-h-10 !rounded-xl !px-3 !py-1.5 text-sm tabular-nums"
          value={hiText}
          onChange={(e) => setHiText(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commitText())}
        />
      </div>
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.min(Math.max(n, a), b);
}

function autoStep(min: number, max: number) {
  const span = max - min;
  if (span >= 100000) return 1000;
  if (span >= 10000) return 500;
  if (span >= 1000) return 50;
  if (span >= 100) return 5;
  return 1;
}

/** Price range (store currency) bound to the `min` / `max` URL params. */
export function PriceRange({
  bounds,
  value,
  onCommit,
}: {
  bounds: [number, number];
  value: [number | undefined, number | undefined];
  onCommit: (v: [number, number] | null) => void;
}) {
  const money = useMoney();
  const [bmin, bmax] = bounds;
  // Round bounds outward to a friendly step so slider ends are clean numbers.
  const step = autoStep(bmin, bmax);
  const min = Math.floor(bmin / step) * step;
  const max = Math.ceil(bmax / step) * step;
  if (max <= min) return <p className="text-sm text-muted">All products are {money(bmin)}</p>;
  return (
    <RangeSlider
      id="price"
      label="Price"
      min={min}
      max={max}
      step={step}
      currency
      value={value[0] != null || value[1] != null ? [value[0] ?? min, value[1] ?? max] : null}
      onCommit={onCommit}
    />
  );
}
