"use client";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, Search, Send, Trash2 } from "lucide-react";
import { submitWholesaleQuote, type QuoteField, type QuoteState } from "@/app/(frontend)/(store)/wholesale/actions";
import { CityCombobox } from "@/components/checkout/city-combobox";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { trackEvent } from "@/components/analytics";
import { useSiteInfo } from "@/components/providers/site-info";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import { cn } from "@/lib/utils";
import { BUYER_TYPES, BUYER_TYPE_LABEL } from "@/lib/wholesale";
import { Turnstile } from "@/components/ui/turnstile";
import { honeypotProps } from "@/lib/honeypot";

export interface QuoteItemDraft {
  productId?: string;
  productName: string;
  qty: number | "";
}

interface Row extends QuoteItemDraft {
  key: string;
}

interface Hit {
  id: string;
  name: string;
  brandName: string;
  categoryName: string;
}

let seq = 0;
const newKey = () => `row-${Date.now().toString(36)}-${seq++}`;

/** Searchable product picker for one item row (free text allowed – picking a suggestion links the catalog product). */
function ItemRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: Row;
  index: number;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abort = useRef<AbortController>(undefined);

  const search = (q: string) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = (await res.json()) as { products?: Hit[] };
        setHits((data.products ?? []).filter((h) => h.id).slice(0, 6));
        setActive(0);
      } catch {}
    }, 220);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = (h: Hit) => {
    onChange({ productId: h.id, productName: h.name });
    setOpen(false);
    setHits([]);
  };

  const showList = open && hits.length > 0;

  return (
    <li className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8.5rem_auto] sm:items-start">
      <div className="relative col-span-2 sm:col-span-1">
        <label htmlFor={`${id}-name`} className="sr-only">
          Item {index + 1} – product or model
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input
          id={`${id}-name`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="input pl-10"
          placeholder="Search a product or type a model, e.g. EliteBook 840 G5 i5 8th Gen"
          value={row.productName}
          onChange={(e) => {
            onChange({ productName: e.target.value, productId: undefined });
            setOpen(true);
            search(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {row.productId && <p className="mt-1 text-[11px] font-medium text-emerald-400">Linked to our catalog</p>}
        {showList && (
          <ul id={listId} role="listbox" className="glass absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-2xl p-1.5 shadow-2xl">
            {hits.map((h, i) => (
              <li
                key={h.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-xl px-3 py-2 text-sm", i === active ? "bg-surface-strong text-fg" : "text-muted")}
              >
                <span className="line-clamp-1 font-medium text-fg">{h.name}</span>
                <span className="text-xs">
                  {h.brandName} · {h.categoryName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex h-12 items-center rounded-full border border-border-strong bg-surface" role="group" aria-label={`Item ${index + 1} quantity`}>
        <button
          type="button"
          onClick={() => onChange({ qty: Math.max(1, (Number(row.qty) || 1) - 1) })}
          aria-label="Decrease quantity"
          className="grid size-11 shrink-0 place-items-center rounded-full text-fg hover:bg-surface-strong"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <label htmlFor={`${id}-qty`} className="sr-only">
          Quantity
        </label>
        <input
          id={`${id}-qty`}
          type="number"
          inputMode="numeric"
          min={1}
          className="w-12 bg-transparent text-center font-semibold tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          value={row.qty}
          onChange={(e) => onChange({ qty: e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value))) })}
        />
        <button
          type="button"
          onClick={() => onChange({ qty: (Number(row.qty) || 0) + 1 })}
          aria-label="Increase quantity"
          className="grid size-11 shrink-0 place-items-center rounded-full text-fg hover:bg-surface-strong"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove item ${index + 1}`}
        className="btn btn-ghost btn-icon h-12 w-12 text-rose-300 disabled:opacity-30"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function WholesaleQuoteForm({ initialItems, source = "/wholesale" }: { initialItems: QuoteItemDraft[]; source?: string }) {
  const [state, action, pending] = useActionState<QuoteState, FormData>(submitWholesaleQuote, { ok: false });
  const site = useSiteInfo(); // the current store's own name and phone (Settings → Store details)
  const phone = primaryPhone(site);
  const [rows, setRows] = useState<Row[]>(() =>
    (initialItems.length ? initialItems : [{ productName: "", qty: 10 }]).map((i) => ({ ...i, key: newKey() }))
  );
  const [city, setCity] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok && state.summary) {
      trackEvent("generate_lead", { method: "wholesale_quote", value: state.units });
      statusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  const err: Partial<Record<QuoteField, string>> = state.ok ? {} : (state.errors ?? {});
  const field = (name: QuoteField) => ({
    "aria-invalid": err[name] ? true : undefined,
    "aria-describedby": err[name] ? `q-${name}-error` : undefined,
  });
  const fieldError = (name: QuoteField) =>
    err[name] ? (
      <p id={`q-${name}-error`} className="mt-1.5 text-xs font-medium text-rose-400">
        {err[name]}
      </p>
    ) : null;

  if (state.ok) {
    return (
      <div ref={statusRef} role="status" aria-live="polite" className="space-y-5 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-400" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-fg">Quote request sent</p>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
          </div>
        </div>
        {state.summary && (
          <>
            <pre className="whitespace-pre-wrap rounded-2xl bg-surface p-4 font-sans text-sm text-fg">{state.summary}</pre>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={waLink(phone.wa, `Hi ${site.name}! I just sent a wholesale quote request on your website.\n\n${state.summary}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-lg"
                onClick={() => trackEvent("whatsapp_wholesale", { value: state.units })}
              >
                <WhatsAppIcon className="size-5" /> Also message us on WhatsApp
              </a>
              {phone.tel && (
                <a href={`tel:${phone.tel}`} className="btn btn-secondary btn-lg">
                  Call {phone.display}
                </a>
              )}
            </div>
            <p className="text-xs text-subtle">WhatsApp is the fastest way to get photos and videos of the stock.</p>
          </>
        )}
      </div>
    );
  }

  const itemsJson = JSON.stringify(
    rows.map((r) => ({ productId: r.productId, productName: r.productName.trim(), qty: r.qty === "" ? 0 : r.qty }))
  );

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        // Submit via the transition (not `action=`) so React keeps what the buyer typed when validation fails.
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {/* Honeypot */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="q-hp">Leave this empty</label>
        <input id="q-hp" {...honeypotProps} />
      </div>
      <Turnstile action="wholesale" />
      <input type="hidden" name="items" value={itemsJson} />
      <input type="hidden" name="source" value={source} />

      <fieldset className="space-y-3">
        <legend className="label">
          What do you need? <span className="text-rose-400">*</span>
        </legend>
        <p className="-mt-1 text-xs text-subtle">Search our catalog or type any model / spec. Add a row per model.</p>
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <ItemRow
              key={r.key}
              row={r}
              index={i}
              canRemove={rows.length > 1}
              onChange={(patch) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, ...patch } : x)))}
              onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            />
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setRows((rs) => [...rs, { key: newKey(), productName: "", qty: 5 }])}
          disabled={rows.length >= 30}
        >
          <Plus className="size-4" aria-hidden="true" /> Add another item
        </button>
        {fieldError("items")}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="q-name" className="label">
            Your name <span className="text-rose-400">*</span>
          </label>
          <input id="q-name" name="name" required autoComplete="name" className="input" placeholder="e.g. Ahmed Raza" {...field("name")} />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="q-business" className="label">
            Business name <span className="font-normal text-subtle">(optional)</span>
          </label>
          <input id="q-business" name="businessName" autoComplete="organization" className="input" placeholder="e.g. Raza Computers" {...field("businessName")} />
          {fieldError("businessName")}
        </div>
        <div>
          <label htmlFor="q-phone" className="label">
            Mobile / WhatsApp <span className="text-rose-400">*</span>
          </label>
          <input id="q-phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" className="input" placeholder="03XX-XXXXXXX" {...field("phone")} />
          {fieldError("phone")}
        </div>
        <div>
          <label htmlFor="q-email" className="label">
            Email <span className="font-normal text-subtle">(optional)</span>
          </label>
          <input id="q-email" name="email" type="email" autoComplete="email" className="input" placeholder="you@company.com" {...field("email")} />
          {fieldError("email")}
        </div>
        <CityCombobox id="q-city" value={city} onChange={setCity} name="city" label="City" required error={err.city} />
        <div>
          <label htmlFor="q-buyer" className="label">
            You are a… <span className="text-rose-400">*</span>
          </label>
          <select id="q-buyer" name="buyerType" className="input" defaultValue="shop" {...field("buyerType")}>
            {BUYER_TYPES.map((b) => (
              <option key={b} value={b}>
                {BUYER_TYPE_LABEL[b]}
              </option>
            ))}
          </select>
          {fieldError("buyerType")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="q-budget" className="label">
            Budget <span className="font-normal text-subtle">(optional)</span>
          </label>
          <input id="q-budget" name="budget" className="input" placeholder="e.g. Rs 60,000 per unit or Rs 15 lakh total" {...field("budget")} />
          {fieldError("budget")}
        </div>
      </div>

      <div>
        <label htmlFor="q-message" className="label">
          Message <span className="font-normal text-subtle">(optional)</span>
        </label>
        <textarea
          id="q-message"
          name="message"
          rows={4}
          className="input resize-y"
          placeholder="Specs, grade (A / B), RAM/SSD upgrades, delivery timeline, payment terms…"
          {...field("message")}
        />
        {fieldError("message")}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-subtle">No wholesale prices are published – we reply with a quote by phone, WhatsApp or email.</p>
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {pending ? "Sending…" : "Request quote"}
        </button>
      </div>

      <div ref={statusRef} aria-live="polite" role="status">
        {state.message && (
          <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 light:text-rose-700">{state.message}</p>
        )}
      </div>
    </form>
  );
}
