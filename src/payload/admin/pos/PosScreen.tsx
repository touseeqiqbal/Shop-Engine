"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminDates, useAdminLocale, useAdminMoney, useStoreRole } from "../ui/store-context";
import { toast } from "../ui/toast";
import { currencyDigits, moneyFormatter, type Money } from "../../../lib/money";
import { dayIn, dayStart } from "../../../lib/time";

/**
 * Shop counter. Scan a barcode (serial number or SKU) or type to search, adjust price / discount,
 * take payment (cash, card, bank, JazzCash, EasyPaisa – or split), print the receipt.
 * Stock is taken the moment the sale completes, from the same stock the website sells.
 */

type Unit = { id: number; serial: string; notes?: string };
type Product = { id: number; title: string; sku: string; price: number; stock: number; trackUnits: boolean; image: string; units: Unit[] };
/** priceText: the price as typed (currencies with cents: "12." on the way to "12.50") */
type Line = { key: string; product: Product; unit?: Unit; qty: number; unitPrice: number; priceText?: string };
type Payment = { method: string; amount: string };
type Sale = { id: number; receiptNumber: string; currency?: string | null; total: number; subtotal: number; discount: number; createdAt: string; status: string; items: { title: string; serial?: string; qty: number; unitPrice: number }[]; payments: { method: string; amount: number }[]; cashReceived?: number; change?: number; customerName?: string; voidReason?: string };

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "other", label: "Wallet / other" },
];
const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));
/** Pakistani stores keep their counter as it was (JazzCash, EasyPaisa); elsewhere: any wallet or bank app as "Wallet / other". */
const methodsFor = (country: string) => METHODS.filter((m) => (country === "PK" ? m.value !== "other" : m.value !== "jazzcash" && m.value !== "easypaisa"));
const int = (s: string) => Math.max(0, Math.round(Number(String(s).replace(/[,\s]/g, "")) || 0));
/** A typed amount in the store's currency (whole rupees, cents …). */
const amt = (s: string, money: Money) => Math.max(0, money.round(Number(String(s).replace(/[,\s]/g, "")) || 0));
const todayIn = (timezone: string) => dayIn(Date.now(), timezone);
/** Money and "today" in the store being worked in. */
function useCounter() {
  const money = useAdminMoney();
  const date = useAdminDates();
  const { timezone, country } = useAdminLocale();
  return { money, date, timezone, today: todayIn(timezone), cents: currencyDigits(money.currency) > 0, methods: methodsFor(country) };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/cms-api${path}`, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

export function PosScreen({ storeName }: { storeName: string }) {
  const { isManager } = useStoreRole();
  const [tab, setTab] = useState<"sell" | "cashup">("sell");
  return (
    <div className="urko-pos">
      <div className="urko-pos__head">
        <h1>Shop counter</h1>
        <nav className="urko-tabs" aria-label="Shop counter">
          <button type="button" className={tab === "sell" ? "is-active" : undefined} aria-pressed={tab === "sell"} onClick={() => setTab("sell")}>
            Sell
          </button>
          <button type="button" className={tab === "cashup" ? "is-active" : undefined} aria-pressed={tab === "cashup"} onClick={() => setTab("cashup")}>
            Cash-up
          </button>
          <a href="/cms/collections/pos-sales">All shop sales</a>
        </nav>
      </div>
      {tab === "sell" ? <Sell storeName={storeName} isManager={isManager} /> : <CashUp />}
    </div>
  );
}

function Sell({ storeName, isManager }: { storeName: string; isManager: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [discountPct, setDiscountPct] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: "" }]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  // one id per sale: pressing "Complete" again (double click, retry after a timeout) can't sell twice
  const saleId = useRef("");
  const [recent, setRecent] = useState<Sale[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const { money, date, timezone, cents, methods } = useCounter();

  // a failed load says so – "No sales yet today" after a failed request misleads the counter
  const [recentFailed, setRecentFailed] = useState(false);
  const loadRecent = useCallback(async () => {
    const start = new Date(dayStart(todayIn(timezone), timezone)).toISOString();
    const j = await api<{ docs: Sale[] }>(`/pos-sales?where[createdAt][greater_than_equal]=${encodeURIComponent(start)}&sort=-createdAt&limit=20&depth=0`).catch(() => null);
    setRecentFailed(!j);
    if (j) setRecent(j.docs);
  }, [timezone]);
  useEffect(() => {
    void loadRecent();
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" || (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadRecent]);

  // the "Sale complete" box: New sale, Escape or a click outside close it, ready for the next scan
  const closeDone = useCallback(() => {
    setDone(null);
    search.current?.focus();
  }, []);
  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, closeDone]);

  // every amount rounded to the currency (no 0.30000000000000004 with cents)
  const subtotal = money.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const disc = Math.min(subtotal, discountPct ? money.round((subtotal * Math.min(100, int(discount))) / 100) : amt(discount, money));
  const total = money.round(subtotal - disc);
  const paidList = payments.map((p, i) => ({ ...p, value: p.amount === "" && i === payments.length - 1 ? Math.max(0, money.round(total - payments.slice(0, -1).reduce((s, x) => s + amt(x.amount, money), 0))) : amt(p.amount, money) }));
  const paid = money.round(paidList.reduce((s, p) => s + p.value, 0));
  const change = Math.max(0, money.round(paid - total));
  const short = Math.max(0, money.round(total - paid));

  function add(product: Product, unit?: Unit) {
    if (unit && lines.some((l) => l.unit?.id === unit.id)) return toast(`Serial ${unit.serial} is already in this sale`, "error");
    if (product.trackUnits && !unit) return setResults([product]);
    if (!product.trackUnits && product.stock <= 0) return toast(`${product.title} is out of stock`, "error");
    setLines((ls) => {
      const existing = !unit && ls.find((l) => l.product.id === product.id && !l.unit);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast(`Only ${product.stock} in stock`, "error");
          return ls;
        }
        return ls.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...ls, { key: `${product.id}-${unit?.id ?? "x"}-${Date.now()}`, product, unit, qty: 1, unitPrice: product.price }];
    });
    toast(`Added ${product.title}${unit ? ` (${unit.serial})` : ""}`, "info");
    setQ("");
    setResults([]);
    setMessage("");
    search.current?.focus();
  }

  async function find(value: string, submit = false) {
    const id = ++seq.current;
    if (value.trim().length < 2) {
      setResults([]);
      setMessage("");
      return;
    }
    try {
      const j = await api<{ exact: { kind: "unit" | "product"; unit?: Unit; product: Product } | null; products: Product[]; message?: string }>(`/pos/lookup?q=${encodeURIComponent(value.trim())}`);
      if (id !== seq.current) return;
      if (j.exact && submit) return add(j.exact.product, j.exact.unit);
      if (j.exact?.kind === "unit" && j.exact.unit) return add(j.exact.product, j.exact.unit);
      setResults(j.products);
      setMessage(j.message ?? (j.products.length ? "" : "Nothing found. Try the name, SKU or serial number."));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void find(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function complete() {
    if (!lines.length) return toast("Add something to the sale first", "error");
    if (short > 0) return toast(`Payment is ${money(short)} short`, "error");
    setBusy(true);
    saleId.current ||= crypto.randomUUID();
    try {
      const j = await api<{ sale: Sale }>("/pos/sale", {
        method: "POST",
        body: JSON.stringify({
          clientSaleId: saleId.current,
          lines: lines.map((l) => ({ productId: l.product.id, unitId: l.unit?.id, qty: l.qty, unitPrice: l.unitPrice })),
          discount: disc,
          payments: paidList.filter((p) => p.value > 0).map((p) => ({ method: p.method, amount: p.value })),
          customerName: customer.name,
          customerPhone: customer.phone,
        }),
      });
      setDone(j.sale);
      saleId.current = "";
      setLines([]);
      setDiscount("");
      setPayments([{ method: "cash", amount: "" }]);
      setCustomer({ name: "", phone: "" });
      toast(`Sale ${j.sale.receiptNumber} done`);
      void loadRecent();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function voidSale(s: Sale) {
    const reason = window.prompt(`Void sale ${s.receiptNumber} (${money(s.total)})? Stock will be put back.\n\nWhy?`);
    if (!reason) return;
    try {
      await api("/pos/void", { method: "POST", body: JSON.stringify({ saleId: s.id, reason }) });
      toast(`Sale ${s.receiptNumber} voided – stock put back`);
      void loadRecent();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="urko-pos__grid">
      <section className="urko-card urko-pos__find" aria-label="Find products">
        <label className="urko-pos__search">
          <span className="urko-sr">Scan or search</span>
          <input
            ref={search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void find(q, true);
              }
            }}
            placeholder="Scan barcode or type name, SKU, serial…  (F2)"
            autoComplete="off"
          />
        </label>
        {/* always in the page so screen readers hear each new lookup answer */}
        <div role="status">{message && <p className="urko-pos__msg">{message}</p>}</div>
        <ul className="urko-pos__results">
          {results.map((p) => (
            <li key={p.id}>
              <div className="urko-pos__result">
                <span className="urko-pcell__img">{p.image ? <img src={p.image} alt="" /> : null}</span>
                <span className="urko-pcell__text">
                  <strong>{p.title}</strong>
                  <small>
                    {p.sku} · {money(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : "out of stock"}
                  </small>
                </span>
                {!p.trackUnits && (
                  <button type="button" className="urko-btn" disabled={p.stock <= 0} onClick={() => add(p)}>
                    Add
                  </button>
                )}
              </div>
              {p.trackUnits && (
                <div className="urko-pos__serials">
                  {p.units.length ? (
                    p.units.map((u) => (
                      <button key={u.id} type="button" className="urko-chip" onClick={() => add(p, u)} title={u.notes}>
                        {u.serial}
                      </button>
                    ))
                  ) : (
                    <small>No units in stock.</small>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <h2 className="urko-pos__h">Today at the counter</h2>
        {recent.length ? (
          <ul className="urko-list urko-pos__recent">
            {recent.map((s) => (
              <li key={s.id} className={s.status === "voided" ? "is-void" : undefined}>
                <span>
                  <strong>{s.receiptNumber}</strong>
                  <small>
                    {date(s.createdAt, { hour: "numeric", minute: "2-digit" })} · {s.payments.map((p) => METHOD_LABEL[p.method] ?? p.method).join(" + ")}
                    {s.status === "voided" ? " · voided" : ""}
                  </small>
                </span>
                <span className="urko-pos__recent-actions">
                  <strong>{saleMoney(s, money)(s.total)}</strong>
                  <button type="button" className="urko-btn urko-btn--sm" onClick={() => printReceipt(s, storeName, money, date)}>
                    Receipt
                  </button>
                  {isManager && s.status !== "voided" && (
                    <button type="button" className="urko-btn urko-btn--sm urko-btn--ghost" onClick={() => voidSale(s)}>
                      Void
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : recentFailed ? (
          <p className="urko-pos__msg" role="alert">
            Couldn’t load today’s sales.{" "}
            <button type="button" className="urko-btn" onClick={() => void loadRecent()}>
              Try again
            </button>
          </p>
        ) : (
          <p className="urko-pos__msg">No sales yet today.</p>
        )}
      </section>

      <section className="urko-card urko-pos__cart" aria-label="Current sale">
        <h2 className="urko-pos__h">Current sale</h2>
        {lines.length === 0 ? (
          <p className="urko-pos__empty">Scan a barcode or search on the left to add items.</p>
        ) : (
          <ul className="urko-pos__lines">
            {lines.map((l) => (
              <li key={l.key}>
                <div className="urko-pos__line-title">
                  <strong>{l.product.title}</strong>
                  {l.unit && <small>Serial {l.unit.serial}</small>}
                </div>
                <div className="urko-pos__line-ctrl">
                  {l.unit ? (
                    <span className="urko-pos__qty">1</span>
                  ) : (
                    <span className="urko-pos__stepper">
                      <button type="button" aria-label={`One less ${l.product.title}`} onClick={() => setLines((ls) => ls.map((x) => (x === l ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>
                        −
                      </button>
                      <span>{l.qty}</span>
                      <button type="button" aria-label={`One more ${l.product.title}`} onClick={() => setLines((ls) => ls.map((x) => (x === l ? { ...x, qty: Math.min(l.product.stock, x.qty + 1) } : x)))}>
                        +
                      </button>
                    </span>
                  )}
                  <label className="urko-pos__price">
                    <span className="urko-sr">Price</span>
                    <input
                      inputMode={cents ? "decimal" : "numeric"}
                      value={l.priceText ?? String(l.unitPrice)}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x === l ? { ...x, unitPrice: amt(e.target.value, money), priceText: cents ? e.target.value : undefined } : x)))}
                    />
                  </label>
                  <button type="button" className="urko-pos__remove" aria-label={`Remove ${l.product.title}`} onClick={() => setLines((ls) => ls.filter((x) => x !== l))}>
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="urko-pos__row">
          <label>
            Discount
            <span className="urko-pos__disc">
              <input inputMode={cents && !discountPct ? "decimal" : "numeric"} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              <button type="button" onClick={() => setDiscountPct((v) => !v)} aria-label="Switch between an amount and percent">
                {discountPct ? "%" : money.symbol}
              </button>
            </span>
          </label>
        </div>

        <dl className="urko-pos__totals">
          <div>
            <dt>Items</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          {disc > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>− {money(disc)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>To pay</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>

        <fieldset className="urko-pos__pay">
          <legend>Payment</legend>
          {payments.map((p, i) => (
            <div key={i} className="urko-pos__payrow">
              <div className="urko-seg" role="radiogroup" aria-label={`Payment ${i + 1} method`}>
                {methods.map((m) => (
                  <button key={m.value} type="button" role="radio" aria-checked={p.method === m.value} className={p.method === m.value ? "is-active" : undefined} onClick={() => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: m.value } : x)))}>
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="urko-pos__amount">
                {p.method === "cash" ? "Cash received" : "Amount"}
                <input inputMode={cents ? "decimal" : "numeric"} value={p.amount} placeholder={String(paidList[i]?.value ?? 0)} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              </label>
              {payments.length > 1 && (
                <button type="button" className="urko-pos__remove" aria-label="Remove this payment" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="urko-linkbtn" onClick={() => setPayments((ps) => [...ps, { method: "card", amount: "" }])}>
            + Split payment
          </button>
          {change > 0 && (
            <p className="urko-pos__change">
              Give change: <strong>{money(change)}</strong>
            </p>
          )}
          {short > 0 && lines.length > 0 && <p className="urko-pos__short">Still to pay: {money(short)}</p>}
        </fieldset>

        <div className="urko-pos__row urko-pos__customer">
          <label>
            Customer name <small>(optional)</small>
            <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </label>
          <label>
            Phone <small>(for warranty)</small>
            <input inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </label>
        </div>

        <button type="button" className="urko-btn urko-btn--primary urko-pos__complete" disabled={busy || !lines.length || short > 0} onClick={complete}>
          {busy ? "Saving…" : `Complete sale · ${money(total)}`}
        </button>
        {lines.length > 0 && (
          <button
            type="button"
            className="urko-linkbtn"
            onClick={() => {
              if (window.confirm("Clear this sale?")) setLines([]);
            }}
          >
            Clear sale
          </button>
        )}
      </section>

      {done && (
        <div className="urko-dialog__backdrop" role="dialog" aria-modal="true" aria-label="Sale complete" onClick={closeDone}>
          <div className="urko-dialog urko-pos__done" onClick={(e) => e.stopPropagation()}>
            <p className="urko-pos__done-ok">✓ Sale complete</p>
            <h2>{money(done.total)}</h2>
            <p>{done.receiptNumber}</p>
            {(done.change ?? 0) > 0 && (
              <p className="urko-pos__change">
                Give change: <strong>{money(done.change ?? 0)}</strong>
              </p>
            )}
            <div className="urko-pos__done-actions">
              <button type="button" className="urko-btn" onClick={() => printReceipt(done, storeName, money, date)}>
                Print receipt
              </button>
              <button
                type="button"
                className="urko-btn urko-btn--primary"
                autoFocus
                onClick={closeDone}
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A sale's amounts in the currency it was made in (older sales without one: the store's). */
const saleMoney = (s: Pick<Sale, "currency">, storeMoney: Money): Money => (s.currency && s.currency !== storeMoney.currency ? moneyFormatter({ currency: s.currency, locale: storeMoney.locale }) : storeMoney);

function printReceipt(s: Sale, storeName: string, storeMoney: Money, date: ReturnType<typeof useAdminDates>) {
  const money = saleMoney(s, storeMoney);
  const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return toast("Allow pop-ups to print receipts", "error");
  const rows = s.items
    .map((i) => `<tr><td>${esc(i.title)}${i.serial ? `<br><small>S/N ${esc(i.serial)}</small>` : ""}${i.qty > 1 ? `<br><small>${i.qty} × ${money(i.unitPrice)}</small>` : ""}</td><td class="n">${money(i.qty * i.unitPrice)}</td></tr>`)
    .join("");
  const pays = s.payments.map((p) => `<tr><td>${esc(METHOD_LABEL[p.method] ?? p.method)}</td><td class="n">${money(p.amount)}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.receiptNumber)}</title><style>
    body{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;width:72mm;margin:0 auto;padding:8px;color:#000}h1{font-size:15px;text-align:center;margin:0 0 4px}
    .c{text-align:center}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}.n{text-align:right;white-space:nowrap}hr{border:0;border-top:1px dashed #000;margin:6px 0}.t td{font-weight:700;font-size:14px}
    @media print{@page{size:80mm auto;margin:0}}</style></head><body>
    <h1>${esc(storeName)}</h1><div class="c">${esc(s.receiptNumber)}<br>${esc(date(s.createdAt, { dateStyle: "medium", timeStyle: "short" }))}</div>
    ${s.status === "voided" ? '<p class="c"><strong>*** VOIDED ***</strong></p>' : ""}<hr>
    <table>${rows}</table><hr><table><tr><td>Items</td><td class="n">${money(s.subtotal)}</td></tr>${s.discount ? `<tr><td>Discount</td><td class="n">− ${money(s.discount)}</td></tr>` : ""}<tr class="t"><td>Total</td><td class="n">${money(s.total)}</td></tr></table><hr>
    <table>${pays}${s.cashReceived ? `<tr><td>Cash given</td><td class="n">${money(s.cashReceived)}</td></tr>` : ""}${s.change ? `<tr><td>Change</td><td class="n">${money(s.change)}</td></tr>` : ""}</table><hr>
    <p class="c">Thank you! Keep this receipt for warranty.</p><script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}

function CashUp() {
  const { money, date, today, cents } = useCounter();
  // "" = today in the store's time zone (known once the store list has loaded)
  const [picked, setDay] = useState("");
  const day = picked || today;
  const [data, setData] = useState<{ count: number; voided: number; total: number; byMethod: Record<string, number>; cash: number; cashUps: { id: number; countedCash: number; expectedCash: number; difference: number; createdAt: string; closedBy?: { name?: string } }[] } | null>(null);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  // the day's figures must have loaded before a cash-up can be saved (zeros after a failed request would be saved
  // as if no sale had been made)
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const j = await api<NonNullable<typeof data>>(`/pos/cashup?day=${day}`).catch(() => null);
    setFailed(!j);
    setData(j);
  }, [day]);
  useEffect(() => {
    void load();
  }, [load]);
  const expected = money.round(amt(opening, money) + (data?.cash ?? 0));
  const diff = counted === "" ? null : money.round(amt(counted, money) - expected);

  async function save() {
    if (counted === "") return toast("Enter the cash you counted", "error");
    setBusy(true);
    try {
      await api("/pos/cashup", { method: "POST", body: JSON.stringify({ day, openingFloat: amt(opening, money), countedCash: amt(counted, money), notes }) });
      toast("Cash-up saved");
      setCounted("");
      setNotes("");
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const methods = useMemo(() => Object.entries(data?.byMethod ?? {}).sort((a, b) => b[1] - a[1]), [data]);
  return (
    <div className="urko-pos__grid">
      <section className="urko-card">
        <label className="urko-pos__day">
          Day
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </label>
        <dl className="urko-pos__totals">
          <div>
            <dt>Sales</dt>
            <dd>
              {data?.count ?? 0}
              {data?.voided ? ` (+${data.voided} voided)` : ""}
            </dd>
          </div>
          {methods.map(([m, v]) => (
            <div key={m}>
              <dt>{METHOD_LABEL[m] ?? m}</dt>
              <dd>{money(v)}</dd>
            </div>
          ))}
          <div className="is-total">
            <dt>Total taken</dt>
            <dd>{money(data?.total ?? 0)}</dd>
          </div>
        </dl>
        {data?.cashUps?.length ? (
          <>
            <h2 className="urko-pos__h">Saved cash-ups for this day</h2>
            <ul className="urko-list">
              {data.cashUps.map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>Counted {money(c.countedCash)}</strong>
                    <small>
                      {date(c.createdAt, { hour: "numeric", minute: "2-digit" })} · {c.closedBy?.name ?? ""}
                    </small>
                  </span>
                  <span className={`urko-badge urko-badge--${c.difference === 0 ? "g" : c.difference > 0 ? "b" : "r"}`}>{c.difference === 0 ? "Exact" : c.difference > 0 ? `${money(c.difference)} over` : `${money(-c.difference)} short`}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <section className="urko-card">
        <h2 className="urko-pos__h">Count the drawer</h2>
        <div className="urko-pos__row urko-pos__customer">
          <label>
            Cash at opening
            <input inputMode={cents ? "decimal" : "numeric"} value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
          </label>
          <label>
            Cash counted now
            <input inputMode={cents ? "decimal" : "numeric"} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" />
          </label>
        </div>
        <dl className="urko-pos__totals">
          <div>
            <dt>Cash expected</dt>
            <dd>{money(expected)}</dd>
          </div>
          {diff !== null && (
            <div className="is-total">
              <dt>{diff === 0 ? "Exact" : diff > 0 ? "Over" : "Short"}</dt>
              <dd className={diff < 0 ? "is-loss" : undefined}>{money(Math.abs(diff))}</dd>
            </div>
          )}
        </dl>
        <label className="urko-pos__notes">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={`e.g. ${money(500)} taken for tea`} />
        </label>
        {failed && (
          <p className="urko-pos__msg" role="alert">
            Couldn’t load this day’s sales – the cash-up can be saved once they have loaded.{" "}
            <button type="button" className="urko-btn" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        <button type="button" className="urko-btn urko-btn--primary urko-pos__complete" disabled={busy || counted === "" || !data} onClick={save}>
          Save cash-up
        </button>
      </section>
    </div>
  );
}
