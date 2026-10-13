"use client";
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Condition, Facet } from "@/lib/types";
import { cn, conditionMeta } from "@/lib/utils";
import { useListing } from "./listing-context";
import { PriceRange, RangeSlider } from "./price-range";

export interface FilterData {
  brands: { value: string; label: string; count: number }[];
  conditions: { value: Condition; count: number }[];
  facets: Facet[];
  priceRange: [number, number];
  showBrand: boolean;
  showCondition: boolean;
}

const CONDITION_ORDER: Condition[] = ["new", "open-box", "used-a-plus", "used-a", "refurbished"];

/** All listing filters. Every control writes straight to the URL (see params.ts for the scheme). */
export function Filters({ data, className }: { data: FilterData; className?: string }) {
  const { params, update, getList, toggleInList } = useListing();
  const uid = useId().replace(/:/g, "");
  const min = params.get("min");
  const max = params.get("max");

  const conditions = [...data.conditions].sort((a, b) => CONDITION_ORDER.indexOf(a.value) - CONDITION_ORDER.indexOf(b.value));

  return (
    <div className={cn("divide-y divide-border", className)}>
      <div className="pb-4">
        <Toggle
          label="In stock only"
          hint="Hide sold-out items"
          checked={params.get("stock") === "1"}
          onChange={(v) => update((p) => (v ? p.set("stock", "1") : p.delete("stock")))}
        />
      </div>

      {data.priceRange[1] > 0 && (
        <Section title="Price (PKR)">
          <PriceRange
            bounds={data.priceRange}
            value={[min ? Number(min) : undefined, max ? Number(max) : undefined]}
            onCommit={(v) =>
              update((p) => {
                if (v) {
                  p.set("min", String(v[0]));
                  p.set("max", String(v[1]));
                } else {
                  p.delete("min");
                  p.delete("max");
                }
              })
            }
          />
        </Section>
      )}

      {data.showBrand && data.brands.length > 1 && (
        <Section title="Brand" count={getList("brand").length}>
          <OptionList
            legend="Brand"
            options={data.brands.map((b) => ({ value: b.value, label: b.label, count: b.count }))}
            selected={getList("brand")}
            onToggle={(v) => toggleInList("brand", v)}
          />
        </Section>
      )}

      {data.showCondition && conditions.length > 0 && (
        <Section title="Condition" count={getList("condition").length}>
          <OptionList
            legend="Condition"
            options={conditions.map((c) => ({ value: c.value, label: conditionMeta[c.value]?.label ?? c.value, count: c.count }))}
            selected={getList("condition")}
            onToggle={(v) => toggleInList("condition", v)}
          />
        </Section>
      )}

      {data.facets.map((f) => {
        if (f.kind === "boolean") {
          const key = `a_${f.key}`;
          const count = f.options[0]?.count ?? 0;
          return (
            <div key={f.key} className="py-4">
              <Toggle
                label={f.label}
                hint={`${count} product${count === 1 ? "" : "s"}`}
                checked={params.get(key) === "true"}
                onChange={(v) => update((p) => (v ? p.set(key, "true") : p.delete(key)))}
              />
            </div>
          );
        }
        if (f.kind === "range") {
          const key = `r_${f.key}`;
          const raw = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(params.get(key) ?? "");
          return (
            <Section key={f.key} title={f.label} count={raw ? 1 : 0}>
              <RangeSlider
                id={`${uid}-${f.key}`}
                label={f.label}
                min={f.min ?? 0}
                max={f.max ?? 0}
                unit={f.unit}
                value={raw ? [Number(raw[1]), Number(raw[2])] : null}
                onCommit={(v) => update((p) => (v ? p.set(key, `${v[0]}-${v[1]}`) : p.delete(key)))}
              />
            </Section>
          );
        }
        const key = `a_${f.key}`;
        return (
          <Section key={f.key} title={f.label} count={getList(key).length}>
            <OptionList
              legend={f.label}
              options={f.options.map((o) => ({ value: o.value, label: f.unit ? `${o.value} ${f.unit}` : o.value, count: o.count }))}
              selected={getList(key)}
              onToggle={(v) => toggleInList(key, v)}
            />
          </Section>
        );
      })}
    </div>
  );
}

function Section({ title, count = 0, children, defaultOpen = true }: { title: string; count?: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="py-4">
      <h3 className="m-0">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold text-fg lg:min-h-8"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            {title}
            {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">{count}</span>}
          </span>
          <ChevronDown className={cn("size-4 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>
      <div id={id} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}

function OptionList({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const LIMIT = 6;
  const [expanded, setExpanded] = useState(false);
  // Always show selected options even when collapsed.
  const visible = expanded || options.length <= LIMIT + 1 ? options : options.filter((o, i) => i < LIMIT || selected.includes(o.value));
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <ul className="space-y-0.5">
        {visible.map((o) => {
          const checked = selected.includes(o.value);
          const disabled = !checked && o.count === 0;
          return (
            <li key={o.value}>
              <label
                className={cn(
                  "group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm transition-colors hover:bg-surface-strong lg:min-h-9",
                  disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
                )}
              >
                <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={() => onToggle(o.value)} />
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border transition-all peer-focus-visible:ring-4 peer-focus-visible:ring-violet-500/40",
                    checked ? "border-transparent bg-brand-gradient text-white" : "border-border-strong bg-surface group-hover:border-violet-500/60"
                  )}
                  aria-hidden="true"
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", checked ? "font-semibold text-fg" : "text-fg/85")}>{o.label}</span>
                <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] tabular-nums text-muted">{o.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {options.length > LIMIT + 1 && (
        <button type="button" className="mt-1 min-h-9 px-2 text-xs font-semibold text-violet-400 hover:text-violet-300" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Show less" : `Show all ${options.length}`}
        </button>
      )}
    </fieldset>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span>
        <span id={id} className="block text-sm font-semibold text-fg">
          {label}
        </span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
          checked ? "border-transparent bg-brand-gradient" : "border-border-strong bg-surface-strong"
        )}
      >
        <span
          className={cn("inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-200", checked ? "translate-x-[1.4rem]" : "translate-x-1")}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
