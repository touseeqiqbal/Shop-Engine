"use client";
import { useCallback, useEffect, useState } from "react";
import { useDocumentInfo } from "@payloadcms/ui";
import { toast } from "../ui/toast";
import { NEXT_STEP, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, intlPhone, rs, timeAgo } from "./status";
import { PROCEED_STATUSES, amountToCollect, creditedAdvance, paymentBlocksShipping } from "@/lib/order-money";

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
  customer?: { name?: string; phone?: string; email?: string; city?: string; address?: string; landmark?: string };
  items?: { title?: string; qty?: number; unitPrice?: number; serials?: string }[];
  subtotal?: number;
  discount?: number;
  deliveryCharge?: number;
  total?: number;
  advancePaid?: number;
  couponCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentScreenshotKey?: string;
  courier?: string;
  trackingNumber?: string;
  history?: { status?: string; at?: string; note?: string }[];
  risk?: { score?: number; level?: string; reasons?: string };
  confirmation?: { token?: string; code?: string; expiresAt?: string; confirmedAt?: string; via?: string };
};

const inHours = (iso?: string) => {
  const ms = iso ? Date.parse(iso) - Date.now() : NaN;
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "any minute now";
  const h = Math.floor(ms / 3600e3);
  return h >= 1 ? `in ${h} hour${h === 1 ? "" : "s"}` : `in ${Math.max(1, Math.round(ms / 60000))} min`;
};

const COURIERS = ["TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier", "BlueEx", "Rider (own)"];

export function OrderPanel() {
  const { id } = useDocumentInfo();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

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
  const wa = phone ? `https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(`Hi ${o.customer?.name?.split(" ")[0] ?? ""}! This is Urko Tech Store about your order ${o.orderNumber}.`)}` : "";
  const history = [...(o.history ?? [])].reverse();

  const waiting = o.status === "awaiting-confirmation";
  const confirmLink = o.confirmation?.token ? `${window.location.origin}/confirm-order/${o.confirmation.token}` : "";
  const waConfirm =
    phone && confirmLink
      ? `https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(
          `Assalam o Alaikum ${o.customer?.name?.split(" ")[0] ?? ""}! Please confirm your Urko Tech Store order ${o.orderNumber} (${rs(total)}, cash on delivery): ${confirmLink}  – or reply YES and we will confirm it for you. Code: ${o.confirmation?.code ?? ""}`
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
      return toast(`Check the ${PAYMENT_METHOD[o.paymentMethod ?? ""] ?? "online"} payment first – approve it below (or change the payment method to cash on delivery).`, "error");
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
            {st.help} {o.placedAt && <span>Placed {timeAgo(o.placedAt)}.</span>}
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

      <div className="urko-opanel__grid">
        <div className="urko-card">
          <h3>Customer</h3>
          <p className="urko-opanel__strong">{o.customer?.name}</p>
          <p>
            {o.customer?.address}
            {o.customer?.landmark ? ` (near ${o.customer.landmark})` : ""}, {o.customer?.city}
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
              <dd>{rs(o.subtotal ?? 0)}</dd>
            </div>
            {(o.discount ?? 0) > 0 && (
              <div>
                <dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt>
                <dd>− {rs(o.discount ?? 0)}</dd>
              </div>
            )}
            <div>
              <dt>Delivery</dt>
              <dd>{(o.deliveryCharge ?? 0) > 0 ? rs(o.deliveryCharge ?? 0) : "Free"}</dd>
            </div>
            <div className="is-total">
              <dt>Total</dt>
              <dd>{rs(total)}</dd>
            </div>
            {advance > 0 && (
              <div>
                <dt>Advance paid</dt>
                <dd>− {rs(advance)}</dd>
              </div>
            )}
            {advance === 0 && claimedAdvance > 0 && o.paymentStatus === "awaiting-verification" && (
              <div>
                <dt>Advance (not checked yet)</dt>
                <dd>{rs(claimedAdvance)}</dd>
              </div>
            )}
          </dl>
          <p className="urko-opanel__collect">
            {toCollect > 0 ? (
              <>
                Rider collects <strong>{rs(toCollect)}</strong>
              </>
            ) : (
              "Fully paid – collect nothing"
            )}
          </p>
          {unpaidOnline && !closed && (
            <p className="urko-opanel__collect" role="alert">
              ⚠️ {PAYMENT_METHOD[o.paymentMethod ?? ""] ?? "Online"} payment not verified – don&apos;t ship yet.
            </p>
          )}
          {o.paymentStatus === "awaiting-verification" && (
            <div className="urko-opanel__verify">
              <p>Check the payment in your {PAYMENT_METHOD[o.paymentMethod ?? ""] ?? "account"} before approving.</p>
              <div className="urko-opanel__contact">
                {o.paymentScreenshotKey && (
                  <a className="urko-btn" href={`/cms-proof/${o.id}`} target="_blank" rel="noreferrer">
                    See screenshot
                  </a>
                )}
                <button type="button" className="urko-btn urko-btn--primary" disabled={busy} onClick={() => patch({ paymentStatus: o.paymentMethod === "cod" ? "partial" : "paid" }, "Payment approved")}>
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
          {o.trackingNumber && (
            <p className="urko-opanel__track">
              {o.courier} · {o.trackingNumber}
            </p>
          )}
        </div>

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
                <small>{h.at ? new Date(h.at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }) : ""}</small>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
