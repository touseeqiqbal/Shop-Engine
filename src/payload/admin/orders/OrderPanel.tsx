"use client";
import { useCallback, useEffect, useState } from "react";
import { useDocumentInfo } from "@payloadcms/ui";
import { toast } from "../ui/toast";
import { useAdminDates, useAdminLocale, useAdminMoney, useStoreName } from "../ui/store-context";
import { NEXT_STEP, ORDER_STATUS, PAYMENT_STATUS, intlPhone, timeAgo } from "./status";
import { cityLine, paymentLabel } from "@/lib/order-display";
import { PROCEED_STATUSES, amountToCollect, creditedAdvance, paidOnDelivery, paymentBlocksShipping, taxLines } from "@/lib/order-money";
import { formatMoney, type Money } from "@/lib/money";
import { integrationInfo, isPaymentIntegration } from "@/lib/integrations/catalog";

/**
 * Top of the order page: what to do next (one big button), money and amount to collect, the customer with
 * Call / WhatsApp, payment check (approve / reject), timeline with notes, and print invoice / packing slip.
 * The full editable form stays below for anything unusual.
 */

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  placedAt?: string;
  customer?: { name?: string; phone?: string; email?: string; city?: string; address?: string; landmark?: string; region?: string; postalCode?: string; country?: string };
  items?: { title?: string; qty?: number; unitPrice?: number; serials?: string; availability?: "preorder" | "backorder" | null; owedQty?: number | null }[];
  subtotal?: number;
  discount?: number;
  deliveryCharge?: number;
  shippingMethod?: string | null;
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
  taxTotal?: number;
  taxBreakdown?: { rate: number; base: number; tax: number }[] | null;
  billing?: { name?: string | null; company?: string | null; taxId?: string | null; address?: string | null; city?: string | null; postalCode?: string | null } | null;
  total?: number;
  advancePaid?: number;
  couponCode?: string;
  paymentMethod?: string;
  paymentMethodLabel?: string | null;
  paymentDue?: string | null;
  paymentStatus?: string;
  paymentScreenshotKey?: string;
  paymentReference?: string;
  courier?: string;
  trackingNumber?: string;
  history?: { status?: string; at?: string; note?: string }[];
  risk?: { score?: number; level?: string; reasons?: string };
  confirmation?: { token?: string; code?: string; expiresAt?: string; confirmedAt?: string; via?: string };
  store?: number | { id?: number } | null;
  /** the currency the order was placed in */
  currency?: string;
  shipments?: Shipment[];
};

type Shipment = {
  id?: string;
  items?: { line?: number; qty?: number; title?: string }[];
  courier?: string;
  trackingNumber?: string;
  status?: string;
  shippedAt?: string;
  deliveredAt?: string;
  provider?: string | null;
  courierStatus?: string | null;
  labelUrl?: string | null;
  codAmount?: number | null;
  codStatus?: string | null;
  codRemittedAt?: string | null;
  codRemittanceRef?: string | null;
};

/** A courier connected in /cms → Integrations, and what it asks for when booking. */
type ConnectedCourier = { provider: string; name: string };
type BookingField = { key: string; label: string; options: { label: string; value: string }[]; default?: string };

const inHours = (iso?: string) => {
  const ms = iso ? Date.parse(iso) - Date.now() : NaN;
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "any minute now";
  const h = Math.floor(ms / 3600e3);
  return h >= 1 ? `in ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.max(1, Math.round(ms / 60000))} min`;
};

type CardPayment = { id: number; kind: string; status: string; amount: number; refundedAmount: number; currency: string; at: string; failureReason?: string | null };

/**
 * Online payments of an order (card through ShopEngine's provider, or the store's own PayPal, JazzCash …) and refunds
 * through the same provider. `money` = the order's; `provider` = the store-connected provider's name, if any.
 */
function CardPayments({ orderId, onDone, money, provider }: { orderId: number; onDone: () => void; money: Money; provider?: string | null }) {
  // each payment in the currency it was charged in
  const paid = (p: CardPayment, n: number) => (p.currency && p.currency.toUpperCase() !== money.currency ? formatMoney(n, { currency: p.currency.toUpperCase(), locale: money.locale }) : money(n));
  const [rows, setRows] = useState<CardPayment[]>([]);
  const [refundable, setRefundable] = useState(0);
  const [elsewhere, setElsewhere] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/cms-api/payments/order/${orderId}`, { credentials: "include" });
    if (!r.ok) return;
    const j = (await r.json()) as { payments: CardPayment[]; refundable: number; refundElsewhere?: string | null };
    setRows(j.payments);
    setRefundable(j.refundable);
    setElsewhere(j.refundElsewhere ?? null);
  }, [orderId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function refund() {
    const value = Number(amount);
    if (!(value > 0) || value > refundable) return toast(`Enter an amount up to ${money(refundable)}.`, "error");
    if (!window.confirm(`Refund ${money(value)} to the customer ${provider ? `through ${provider}` : "'s card"}? This can't be undone.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/cms-api/payments/refund", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, amount: value, reason }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return toast(j.error ?? "The refund failed.", "error");
      toast("Refund sent");
      setAmount("");
      setReason("");
      await load();
      onDone();
    } finally {
      setBusy(false);
    }
  }
  if (!rows.length) return <p className="urko-opanel__help">{provider ? `No ${provider} payment yet.` : "No card payment yet."}</p>;
  return (
    <div className="urko-opanel__verify">
      <ul>
        {rows.map((p) => (
          <li key={p.id}>
            {p.kind === "refund" ? "Refund" : "Payment"} {paid(p, p.amount)} · {p.status.replace(/_/g, " ")}
            {p.refundedAmount > 0 && p.kind === "charge" ? ` (refunded ${paid(p, p.refundedAmount)})` : ""}
            {p.failureReason ? ` – ${p.failureReason}` : ""}
          </li>
        ))}
      </ul>
      {elsewhere && <p className="urko-opanel__help">To refund, use your {elsewhere} merchant account, then record it in Orders → Returns.</p>}
      {refundable > 0 && (
        <div className="urko-opanel__contact">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Up to ${refundable}`} aria-label="Refund amount" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" aria-label="Refund reason" />
          <button type="button" className="urko-btn" disabled={busy || !amount} onClick={refund}>
            {provider ? `Refund through ${provider}` : "Refund to card"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Courier suggestions (any name can be typed): Pakistan's, else international ones with tracking links (lib/couriers.ts). */
const couriersFor = (country: string) => (country === "PK" ? ["TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier", "BlueEx", "Rider (own)"] : ["DHL", "FedEx", "UPS", "Aramex", "USPS", "Royal Mail", "Rider (own)"]);

const SHIPPABLE = new Set(["confirmed", "dispatched", "out-for-delivery"]);

/**
 * Parcels of this order: send some (or all remaining) items – booked with a connected courier (tracking number and
 * label come back, status followed automatically) or with a tracking number typed in – then each parcel is delivered,
 * returned or cancelled.
 */
function Shipments({ order, onDone, money }: { order: Order; onDone: () => void; money: Money }) {
  const COURIERS = couriersFor(useAdminLocale(order.store).country);
  const items = order.items ?? [];
  const shipments = order.shipments ?? [];
  const sent = new Map<number, number>();
  for (const s of shipments) if (s.status !== "cancelled") for (const it of s.items ?? []) sent.set(Number(it.line), (sent.get(Number(it.line)) ?? 0) + (Number(it.qty) || 0));
  const left = items.map((it, i) => Math.max(0, (Number(it.qty) || 0) - (sent.get(i) ?? 0)));
  const [qty, setQty] = useState<number[]>(left);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<ConnectedCourier[]>([]);
  // "" = typed in by hand; else the courier integration to book with
  const [via, setVia] = useState("");
  const [fields, setFields] = useState<BookingField[] | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [parcel, setParcel] = useState({ weightKg: "", pieces: "1", codAmount: "" });
  const canShip = SHIPPABLE.has(order.status) && left.some((n) => n > 0);
  const qtyKey = qty.join(",");

  useEffect(() => {
    if (!canShip) return;
    let live = true;
    void fetch("/cms-api/integration-tools/couriers", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { couriers: [] }))
      .then((j: { couriers?: ConnectedCourier[] }) => {
        if (!live) return;
        setConnected(j.couriers ?? []);
        if (j.couriers?.length) setVia((v) => v || j.couriers![0].provider);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [canShip]);

  // the booking choices (city, service, pickup address) for the chosen courier and these items
  useEffect(() => {
    if (!open || !via) {
      setFields(null);
      return;
    }
    const l = qtyKey.split(",").map((q, line) => ({ line, qty: Math.min(Number(q) || 0, left[line] ?? 0) })).filter((x) => x.qty > 0);
    if (!l.length) return;
    let live = true;
    setFields(null);
    void fetch(`/cms-api/integration-tools/courier/options?provider=${encodeURIComponent(via)}&orderId=${order.id}&lines=${encodeURIComponent(JSON.stringify(l))}`, { credentials: "include" })
      .then(async (r) => ({ ok: r.ok, j: (await r.json()) as { error?: string; fields?: BookingField[]; parcel?: { weightKg: number; pieces: number; codAmount: number } } }))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) {
          toast(j.error ?? "Couldn't load the courier's options.", "error");
          setFields([]);
          return;
        }
        setFields(j.fields ?? []);
        setChoices(Object.fromEntries((j.fields ?? []).map((f) => [f.key, f.default ?? ""])));
        if (j.parcel) setParcel({ weightKg: String(j.parcel.weightKg), pieces: String(j.parcel.pieces), codAmount: String(j.parcel.codAmount) });
      })
      .catch(() => {
        if (live) setFields([]);
      });
    return () => {
      live = false;
    };
    // left is derived from the order; qtyKey stands for the parcel's items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, via, qtyKey, order.id]);

  if (!shipments.length && !canShip) return null;

  async function post(path: string, body: unknown, done: string) {
    setBusy(true);
    try {
      const r = await fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; trackingNumber?: string };
      if (!r.ok) return toast(j.error ?? "Couldn't save – please try again.", "error");
      toast(j.trackingNumber ? `${done} – tracking ${j.trackingNumber}` : done);
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  }
  const lines = () => qty.map((q, line) => ({ line, qty: Math.min(q, left[line]) })).filter((l) => l.qty > 0);
  const ship = () => {
    const l = lines();
    if (!l.length) return toast("Choose how many of each item go in this parcel.", "error");
    if (via) {
      const missing = (fields ?? []).find((f) => f.options.length && !choices[f.key]);
      if (missing) return toast(`Choose the ${missing.label.toLowerCase()}.`, "error");
      return void post(
        "/cms-api/integration-tools/courier/book",
        { orderId: order.id, provider: via, lines: l, weightKg: Number(parcel.weightKg) || undefined, pieces: Number(parcel.pieces) || 1, codAmount: parcel.codAmount === "" ? undefined : Number(parcel.codAmount), options: choices },
        "Booked",
      );
    }
    void post("/cms-api/order-tools/ship", { orderId: order.id, lines: l, courier, trackingNumber: tracking }, "Parcel sent");
  };
  const label = (i: number) => window.open(`/cms-api/integration-tools/courier/label?orderId=${order.id}&index=${i}`, "_blank", "noopener");
  const viaName = connected.find((c) => c.provider === via)?.name;
  const cancelParcel = (s: Shipment, i: number) => {
    if (!window.confirm(s.provider ? `Cancel this booking with ${s.courier ?? "the courier"}? Its items can be sent again.` : "Cancel this parcel? Its items can be sent again.")) return;
    if (s.provider) void post("/cms-api/integration-tools/courier/cancel", { orderId: order.id, index: i }, "Booking cancelled");
    else void post("/cms-api/order-tools/shipment", { orderId: order.id, index: i, status: "cancelled" }, "Parcel cancelled");
  };

  return (
    <div className="urko-card">
      <h3>Shipments</h3>
      {shipments.length > 0 && (
        <ul>
          {shipments.map((s, i) => (
            <li key={s.id ?? i}>
              <strong>{(s.items ?? []).map((it) => `${it.title ?? "Item"} × ${it.qty}`).join(", ")}</strong>
              <br />
              <small>
                {[s.courier, s.trackingNumber].filter(Boolean).join(" · ") || "No tracking"} · {s.status === "delivered" ? "Delivered" : s.status === "cancelled" ? "Cancelled" : s.status === "returned" ? "Returned" : "On the way"}
                {s.courierStatus && s.status === "shipped" ? ` · ${s.courierStatus}` : ""}
              </small>
              {(s.codAmount ?? 0) > 0 && (
                <>
                  <br />
                  <small>
                    Cash to collect {money(s.codAmount ?? 0)} ·{" "}
                    {s.codStatus === "remitted"
                      ? `paid to you${s.codRemittedAt ? ` on ${new Date(s.codRemittedAt).toLocaleDateString()}` : ""}${s.codRemittanceRef ? ` (ref ${s.codRemittanceRef})` : ""}`
                      : s.status === "delivered"
                        ? "collected, not paid to you yet"
                        : "not collected yet"}
                  </small>
                </>
              )}
              <div className="urko-opanel__contact">
                {(s.provider || s.labelUrl) && s.trackingNumber && (
                  <button type="button" className="urko-btn urko-btn--ghost" onClick={() => label(i)}>
                    Print label
                  </button>
                )}
                {s.provider && (s.status === "shipped" || s.codStatus === "pending") && (
                  <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => void post("/cms-api/integration-tools/courier/track", { orderId: order.id, index: i }, "Checked with the courier")}>
                    Check status
                  </button>
                )}
                {s.status === "shipped" && (
                  <>
                    <button type="button" className="urko-btn" disabled={busy} onClick={() => void post("/cms-api/order-tools/shipment", { orderId: order.id, index: i, status: "delivered" }, "Marked as delivered")}>
                      Delivered
                    </button>
                    <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => window.confirm("Mark this parcel as returned to you?") && void post("/cms-api/order-tools/shipment", { orderId: order.id, index: i, status: "returned" }, "Marked as returned")}>
                      Returned
                    </button>
                    <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={() => cancelParcel(s, i)}>
                      Cancel parcel
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canShip && !open && (
        <button type="button" className="urko-btn" onClick={() => (setQty(left), setOpen(true))}>
          Ship items{shipments.length ? " (the rest)" : ""}
        </button>
      )}
      {canShip && open && (
        <div className="urko-opanel__ship">
          {items.map((it, i) =>
            left[i] > 0 ? (
              <label key={i}>
                {it.title} (up to {left[i]})
                <input type="number" min={0} max={left[i]} value={qty[i] ?? 0} onChange={(e) => setQty((q) => q.map((v, k) => (k === i ? Math.max(0, Math.min(left[i], Number(e.target.value) || 0)) : v)))} />
              </label>
            ) : null,
          )}
          {connected.length > 0 && (
            <label>
              Send with
              <select value={via} onChange={(e) => setVia(e.target.value)}>
                {connected.map((c) => (
                  <option key={c.provider} value={c.provider}>
                    {c.name} (book automatically)
                  </option>
                ))}
                <option value="">Another courier – type the tracking number</option>
              </select>
            </label>
          )}
          {via ? (
            fields === null ? (
              <p className="urko-opanel__help">Loading {viaName}’s options…</p>
            ) : (
              <>
                {fields.map((f) =>
                  f.options.length ? (
                    <label key={f.key}>
                      {f.label}
                      <select value={choices[f.key] ?? ""} onChange={(e) => setChoices({ ...choices, [f.key]: e.target.value })}>
                        <option value="">Choose…</option>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null,
                )}
                <label>
                  Weight (kg)
                  <input inputMode="decimal" value={parcel.weightKg} onChange={(e) => setParcel({ ...parcel, weightKg: e.target.value })} />
                </label>
                <label>
                  Pieces
                  <input type="number" min={1} value={parcel.pieces} onChange={(e) => setParcel({ ...parcel, pieces: e.target.value })} />
                </label>
                <label>
                  Cash to collect ({money.currency})
                  <input inputMode="decimal" value={parcel.codAmount} onChange={(e) => setParcel({ ...parcel, codAmount: e.target.value })} />
                </label>
              </>
            )
          ) : (
            <>
              <label>
                Courier
                <select value={courier} onChange={(e) => setCourier(e.target.value)}>
                  <option value="">Choose…</option>
                  {COURIERS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Tracking number
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </label>
            </>
          )}
          <button type="button" className="urko-btn urko-btn--primary" disabled={busy || (Boolean(via) && fields === null)} onClick={ship}>
            {busy ? "Working…" : via ? `Book with ${viaName ?? "the courier"}` : "Send this parcel"}
          </button>
        </div>
      )}
    </div>
  );
}

export function OrderPanel() {
  const { id } = useDocumentInfo();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  // the order's own store, named in messages to the customer; money in the currency the order was placed in
  const storeName = useStoreName(order?.store);
  const loc = useAdminLocale(order?.store);
  const COURIERS = couriersFor(loc.country);
  const money = useAdminMoney(order?.store, order?.currency);
  const date = useAdminDates(order?.store);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/cms-api/orders/${id}?depth=0`, { credentials: "include" });
    if (r.ok) setOrder((await r.json()) as Order);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!id || !order) return null;

  async function patch(data: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      // expectStatus: the server refuses if someone (a colleague, the customer, auto-cancel) changed it meanwhile
      const r = await fetch(`/cms-api/orders/${id}?depth=0&expectStatus=${encodeURIComponent(order?.status ?? "")}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { errors?: { message?: string }[] };
        throw new Error(j.errors?.[0]?.message || "Could not save");
      }
      toast(done);
      // reload so the form below shows the new values too
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  const o = order;
  const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "n", help: "" };
  const pay = PAYMENT_STATUS[o.paymentStatus ?? ""] ?? { label: o.paymentStatus ?? "—", tone: "n" };
  const next = NEXT_STEP[o.status];
  const total = o.total ?? 0;
  const advance = creditedAdvance(o); // only an APPROVED advance lowers what the rider collects
  const claimedAdvance = o.advancePaid ?? 0;
  const closed = ["delivered", "cancelled", "refused", "returned"].includes(o.status);
  const toCollect = amountToCollect(o);
  const unpaidOnline = paymentBlocksShipping(o);
  const phone = o.customer?.phone ?? "";
  const wa = phone ? `https://wa.me/${intlPhone(phone, loc.country)}?text=${encodeURIComponent(`Hi ${o.customer?.name?.split(" ")[0] ?? ""}! ${storeName ? `This is ${storeName} about` : "A message about"} your order ${o.orderNumber}.`)}` : "";
  const history = [...(o.history ?? [])].reverse();

  const waiting = o.status === "awaiting-confirmation";
  const confirmLink = o.confirmation?.token ? `${window.location.origin}/confirm-order/${o.confirmation.token}` : "";
  const waConfirm =
    phone && confirmLink
      ? `https://wa.me/${intlPhone(phone, loc.country)}?text=${encodeURIComponent(
          `${loc.country === "PK" ? "Assalam o Alaikum" : "Hi"} ${o.customer?.name?.split(" ")[0] ?? ""}! Please confirm your ${storeName ? `${storeName} ` : ""}order ${o.orderNumber} (${money(total)}, cash on delivery): ${confirmLink}  – or reply YES and we will confirm it for you. Code: ${o.confirmation?.code ?? ""}`
        )}`
      : "";

  async function resendConfirmation() {
    setBusy(true);
    try {
      const r = await fetch("/cms-api/order-tools/resend-confirmation", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Could not send");
      toast("Confirmation link sent again");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function blockNumber() {
    const reason = window.prompt(`Block online orders from ${phone}?\nWhy? (only your team sees this)`, o.status === "refused" ? "Refused parcel" : "");
    if (reason === null) return;
    const advanceOnly = window.confirm("Press OK to allow orders only with advance payment, or Cancel to block online orders completely.");
    const r = await fetch("/cms-api/blocked-phones", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, reason, name: o.customer?.name, action: advanceOnly ? "advance" : "block" }),
    });
    if (r.ok) toast(advanceOnly ? "This number now needs an advance payment" : "This number is blocked from online orders");
    else toast("Could not save – is this number already on the list?", "error");
  }

  function runNext() {
    if (!next) return;
    if (unpaidOnline && PROCEED_STATUSES.has(next.to))
      return toast(`Check the ${paymentLabel(o.paymentMethod, o.paymentMethodLabel) || "online"} payment first – approve it below (or change the payment method to cash on delivery).`, "error");
    if (next.askCourier && !shipping) return setShipping(true);
    if (next.askCourier && (!courier || !tracking.trim())) return toast("Choose the courier and enter the tracking number", "error");
    const extra = waiting ? { confirmation: { ...o.confirmation, confirmedAt: new Date().toISOString(), via: "phone call (staff)" } } : {};
    void patch(next.askCourier ? { status: next.to, courier, trackingNumber: tracking.trim() } : { status: next.to, ...extra }, `Order ${ORDER_STATUS[next.to]?.label.toLowerCase() ?? "updated"}`);
  }

  function cancel() {
    if (!window.confirm(`Cancel order ${o.orderNumber}? The customer will be told and stock is put back.`)) return;
    void patch({ status: "cancelled" }, "Order cancelled");
  }

  function addNote() {
    if (!note.trim()) return;
    void patch({ history: [...(o.history ?? []), { status: o.status, at: new Date().toISOString(), note: note.trim() }] }, "Note added");
  }

  return (
    <section className="urko-opanel" aria-label="Order summary">
      <div className="urko-opanel__top">
        <div>
          <div className="urko-opanel__badges">
            <span className={`urko-badge urko-badge--${st.tone}`}>{st.label}</span>
            <span className={`urko-badge urko-badge--${pay.tone}`}>{pay.label}</span>
            {o.risk?.level && o.risk.level !== "low" && (
              <span className={`urko-badge urko-badge--${o.risk.level === "high" ? "r" : "y"}`} title={o.risk.reasons}>
                {o.risk.level === "high" ? "High risk" : "Some risk"}
              </span>
            )}
          </div>
          <p className="urko-opanel__help">
            {st.help} {o.placedAt && <span>Placed {timeAgo(o.placedAt, loc)}.</span>}
          </p>
        </div>
        <div className="urko-opanel__print">
          <a href={`/cms-print/${o.id}?type=invoice`} target="_blank" rel="noreferrer">
            Print invoice
          </a>
          <a href={`/cms-print/${o.id}?type=slip`} target="_blank" rel="noreferrer">
            Packing slip
          </a>
        </div>
      </div>

      {(next || !closed) && (
        <div className="urko-opanel__actions">
          {shipping && next?.askCourier && (
            <div className="urko-opanel__ship">
              <label>
                Courier
                <select value={courier} onChange={(e) => setCourier(e.target.value)}>
                  <option value="">Choose…</option>
                  {COURIERS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Tracking number
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 7731 2244 9" />
              </label>
            </div>
          )}
          {next && (
            <button type="button" className="urko-btn urko-btn--primary" disabled={busy} onClick={runNext}>
              {shipping && next.askCourier ? "Save & mark as shipped" : next.label}
            </button>
          )}
          {(o.status === "dispatched" || o.status === "out-for-delivery") && (
            <button
              type="button"
              className="urko-btn"
              disabled={busy}
              onClick={() => window.confirm("The customer refused the parcel? It counts against their risk score and stock goes back.") && void patch({ status: "refused" }, "Marked as refused (RTO)")}
            >
              Refused (RTO)
            </button>
          )}
          {!closed && (
            <button type="button" className="urko-btn urko-btn--ghost" disabled={busy} onClick={cancel}>
              Cancel order
            </button>
          )}
          {waiting && (
            <div className="urko-opanel__waiting">
              <p>
                Waiting for the customer to confirm by link or code. <strong>Cancels automatically {inHours(o.confirmation?.expiresAt)}</strong> if they don&apos;t.
              </p>
              <div className="urko-opanel__contact">
                {waConfirm && (
                  <a className="urko-btn" href={waConfirm} target="_blank" rel="noreferrer">
                    Send link on WhatsApp
                  </a>
                )}
                <button type="button" className="urko-btn" disabled={busy} onClick={resendConfirmation}>
                  Resend automatically
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(o.items ?? []).some((it) => it.availability) && !closed && (
        // sold before release or beyond the stock: these can't ship until the stock arrives
        <p className="urko-opanel__collect" role="note">
          ⏳ Ships later:{" "}
          {(o.items ?? [])
            .filter((it) => it.availability)
            .map((it) => `${it.owedQty ?? it.qty} × ${it.title ?? "item"} (${it.availability === "preorder" ? "pre-order" : "backorder"})`)
            .join(", ")}
          . Ship when the stock arrives – or send the rest first in a separate parcel.
        </p>
      )}

      <div className="urko-opanel__grid">
        <div className="urko-card">
          <h3>Customer</h3>
          <p className="urko-opanel__strong">{o.customer?.name}</p>
          <p>
            {o.customer?.address}
            {o.customer?.landmark ? ` (near ${o.customer.landmark})` : ""}, {cityLine(o.customer ?? {}, loc.country)}
          </p>
          <p>{phone}</p>
          {o.customer?.email && <p>{o.customer.email}</p>}
          {o.risk?.level && (
            <p className="urko-opanel__risk">
              <span className={`urko-badge urko-badge--${o.risk.level === "high" ? "r" : o.risk.level === "medium" ? "y" : "g"}`}>
                Risk {o.risk.score ?? 0}/100
              </span>{" "}
              {o.risk.reasons}
            </p>
          )}
          {o.confirmation?.confirmedAt && <p className="urko-opanel__risk">✓ Confirmed by customer ({o.confirmation.via})</p>}
          {o.billing?.name && (
            // the invoice is made out to someone else (a company with a VAT / tax number)
            <p className="urko-opanel__risk">
              <strong>Invoice to:</strong> {[o.billing.company, o.billing.name].filter(Boolean).join(" – ")}
              {o.billing.taxId ? ` · VAT / tax no. ${o.billing.taxId}` : ""}
              <br />
              {[o.billing.address, o.billing.city, o.billing.postalCode].filter(Boolean).join(", ")}
            </p>
          )}
          {phone && (
            <div className="urko-opanel__contact">
              <a className="urko-btn" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                Call
              </a>
              <a className="urko-btn" href={wa} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <button type="button" className="urko-btn urko-btn--ghost" onClick={blockNumber}>
                Block this number
              </button>
            </div>
          )}
        </div>

        <div className="urko-card">
          <h3>Money</h3>
          <dl className="urko-opanel__money">
            <div>
              <dt>Items</dt>
              <dd>{money(o.subtotal ?? 0)}</dd>
            </div>
            {(o.discount ?? 0) > 0 && (
              <div>
                <dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt>
                <dd>− {money(o.discount ?? 0)}</dd>
              </div>
            )}
            <div>
              <dt>Delivery</dt>
              <dd>
                {(o.deliveryCharge ?? 0) > 0 ? money(o.deliveryCharge ?? 0) : "Free"}
                {o.shippingMethod ? ` · ${o.shippingMethod}` : ""}
              </dd>
            </div>
            {taxLines(o).lines.map((t) => (
              <div key={t.label}>
                <dt>{taxLines(o).added ? t.label : `${t.label} (in the total)`}</dt>
                <dd>{money(t.amount)}</dd>
              </div>
            ))}
            <div className="is-total">
              <dt>Total</dt>
              <dd>{money(total)}</dd>
            </div>
            {(o.giftCardAmount ?? 0) > 0 && (
              <div>
                <dt>Gift card{o.giftCardCode ? ` ••••${o.giftCardCode.slice(-4)}` : ""}</dt>
                <dd>− {money(o.giftCardAmount ?? 0)}</dd>
              </div>
            )}
            {advance > 0 && (
              <div>
                <dt>Advance paid</dt>
                <dd>− {money(advance)}</dd>
              </div>
            )}
            {advance === 0 && claimedAdvance > 0 && o.paymentStatus === "awaiting-verification" && (
              <div>
                <dt>Advance (not checked yet)</dt>
                <dd>{money(claimedAdvance)}</dd>
              </div>
            )}
          </dl>
          <p className="urko-opanel__collect">
            {toCollect > 0 ? (
              <>
                Rider collects <strong>{money(toCollect)}</strong>
              </>
            ) : (
              "Fully paid – collect nothing"
            )}
          </p>
          {unpaidOnline && !closed && (
            <p className="urko-opanel__collect" role="alert">
              ⚠️ {paymentLabel(o.paymentMethod, o.paymentMethodLabel) || "Online"} payment not verified – don&apos;t ship yet.
            </p>
          )}
          {o.paymentStatus === "awaiting-verification" && (
            <div className="urko-opanel__verify">
              <p>Check the payment in your {paymentLabel(o.paymentMethod, o.paymentMethodLabel) || "account"} before approving.</p>
              {o.paymentReference && (
                <p>
                  Transaction ID: <strong>{o.paymentReference}</strong>
                </p>
              )}
              <div className="urko-opanel__contact">
                {o.paymentScreenshotKey && (
                  <a className="urko-btn" href={`/cms-proof/${o.id}`} target="_blank" rel="noreferrer">
                    See screenshot
                  </a>
                )}
                <button type="button" className="urko-btn urko-btn--primary" disabled={busy} onClick={() => patch({ paymentStatus: paidOnDelivery(o) ? "partial" : "paid" }, "Payment approved")}>
                  Approve
                </button>
                <button
                  type="button"
                  className="urko-btn urko-btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    const why = window.prompt("Why is the payment rejected? (the customer is not told automatically)", "Amount not received");
                    if (why === null) return;
                    void patch({ paymentStatus: "unpaid", advancePaid: null, history: [...(o.history ?? []), { status: o.status, at: new Date().toISOString(), note: `Payment rejected: ${why}` }] }, "Payment rejected");
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
          {(o.paymentMethod === "card" || isPaymentIntegration(o.paymentMethod)) && <CardPayments orderId={o.id} onDone={() => void load()} money={money} provider={o.paymentMethod === "card" ? null : integrationInfo(o.paymentMethod)?.name} />}
          {o.trackingNumber && (
            <p className="urko-opanel__track">
              {o.courier} · {o.trackingNumber}
            </p>
          )}
        </div>

        <Shipments order={o} onDone={() => void load()} money={money} />

        <div className="urko-card urko-opanel__timeline">
          <h3>Timeline</h3>
          <div className="urko-opanel__note">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for your team…" aria-label="Note" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNote())} />
            <button type="button" className="urko-btn" disabled={busy || !note.trim()} onClick={addNote}>
              Add
            </button>
          </div>
          <ol>
            {history.map((h, i) => (
              <li key={i}>
                <strong>{h.note ? h.note : (ORDER_STATUS[h.status ?? ""]?.label ?? h.status)}</strong>
                <small>{h.at ? date(h.at, { dateStyle: "medium", timeStyle: "short" }) : ""}</small>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
