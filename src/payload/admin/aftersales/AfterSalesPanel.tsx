"use client";
import { useCallback, useEffect, useState } from "react";
import { useDocumentInfo } from "@payloadcms/ui";
import { toast } from "../ui/toast";
import { useAdminDates, useAdminLocale, useAdminMoney, useStoreName } from "../ui/store-context";
import { intlPhone, timeAgo } from "../orders/status";
import { currencyDigits } from "../../../lib/money";

/**
 * Top of a return / warranty claim: where it is, the one next step (plus the alternatives), refund details,
 * Call / WhatsApp the customer and the credit note. The full form stays below.
 */

type Kind = "return" | "warranty";
type Doc = {
  id: number;
  status: string;
  requestNumber?: string;
  claimNumber?: string;
  orderNumber?: string;
  order?: number | null;
  customerName?: string;
  customerPhone?: string;
  reason?: string;
  changeOfMind?: boolean;
  items?: { title?: string; qty?: number; unitPrice?: number; serial?: string }[];
  refundMethod?: string;
  refundAmount?: number;
  restock?: boolean;
  restocked?: boolean;
  creditNoteNumber?: string;
  inWarranty?: string;
  warrantyEndsAt?: string;
  purchasedAt?: string;
  checkNote?: string;
  serial?: string;
  createdAt?: string;
  history?: { status?: string; at?: string; note?: string }[];
  store?: number | { id?: number } | null;
};

const LABEL: Record<string, { label: string; tone: string }> = {
  requested: { label: "New request", tone: "y" },
  approved: { label: "Approved – waiting for item", tone: "b" },
  rejected: { label: "Rejected", tone: "n" },
  received: { label: "Item received", tone: "b" },
  inspected: { label: "Inspected", tone: "b" },
  refunded: { label: "Refunded", tone: "g" },
  replaced: { label: "Replaced", tone: "g" },
  repaired: { label: "Repaired", tone: "g" },
  open: { label: "Open", tone: "y" },
  "in-repair": { label: "In repair", tone: "b" },
  returned: { label: "Returned to customer", tone: "g" },
};

type Step = { to: string; label: string; primary?: boolean; ask?: "reject" | "refund" };
const RETURN_STEPS: Record<string, Step[]> = {
  requested: [{ to: "approved", label: "Approve return", primary: true }, { to: "rejected", label: "Reject", ask: "reject" }],
  approved: [{ to: "received", label: "Item received", primary: true }, { to: "rejected", label: "Reject", ask: "reject" }],
  received: [{ to: "inspected", label: "Inspection done", primary: true }],
  inspected: [
    { to: "refunded", label: "Refund", primary: true, ask: "refund" },
    { to: "replaced", label: "Replaced" },
    { to: "repaired", label: "Repaired" },
    { to: "rejected", label: "Reject", ask: "reject" },
  ],
};
const WARRANTY_STEPS: Record<string, Step[]> = {
  open: [{ to: "received", label: "Item received", primary: true }, { to: "rejected", label: "Not covered", ask: "reject" }],
  received: [{ to: "in-repair", label: "Start repair", primary: true }, { to: "replaced", label: "Replaced" }, { to: "rejected", label: "Not covered", ask: "reject" }],
  "in-repair": [{ to: "repaired", label: "Repaired", primary: true }, { to: "replaced", label: "Replaced" }],
  repaired: [{ to: "returned", label: "Given back to customer", primary: true }],
  replaced: [{ to: "returned", label: "Given back to customer", primary: true }],
  rejected: [{ to: "returned", label: "Given back to customer", primary: true }],
};

export function AfterSalesPanel({ kind }: { kind: Kind }) {
  const { id } = useDocumentInfo();
  const collection = kind === "return" ? "return-requests" : "warranty-claims";
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState<{ method: string; amount: string; restock: boolean } | null>(null);
  // the request's own store, named in messages to the customer; its currency and time zone
  const storeName = useStoreName(doc?.store);
  const loc = useAdminLocale(doc?.store);
  const money = useAdminMoney(doc?.store);
  const date = useAdminDates(doc?.store);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/cms-api/${collection}/${id}?depth=0`, { credentials: "include" });
    if (r.ok) setDoc((await r.json()) as Doc);
  }, [id, collection]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!id || !doc) return null;

  async function patch(data: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const r = await fetch(`/cms-api/${collection}/${id}?depth=0`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { errors?: { message?: string }[] }).errors?.[0]?.message || "Could not save");
      toast(done);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  const paid = (doc.items ?? []).reduce((s, i) => s + (i.unitPrice ?? 0) * (i.qty ?? 1), 0);
  function run(step: Step) {
    if (step.ask === "reject") {
      const why = window.prompt(kind === "return" ? "Why is the return rejected? (the customer is told)" : "Why isn't it covered? (the customer is told)");
      if (!why) return;
      return void patch(kind === "return" ? { status: step.to, rejectionReason: why } : { status: step.to, resolution: why }, "Saved");
    }
    if (step.ask === "refund") return setRefund({ method: doc!.refundMethod ?? "cash", amount: String(doc!.refundAmount ?? paid), restock: doc!.restock ?? true });
    void patch({ status: step.to }, `Marked: ${LABEL[step.to]?.label ?? step.to}`);
  }

  const s = LABEL[doc.status] ?? { label: doc.status, tone: "n" };
  const steps = (kind === "return" ? RETURN_STEPS : WARRANTY_STEPS)[doc.status] ?? [];
  const phone = doc.customerPhone ?? "";
  const number = doc.requestNumber ?? doc.claimNumber ?? "";
  const wa = phone ? `https://wa.me/${intlPhone(phone, loc.country)}?text=${encodeURIComponent(`Hi ${doc.customerName?.split(" ")[0] ?? ""}! ${storeName ? `This is ${storeName} about` : "A message about"} your ${kind === "return" ? "return" : "warranty claim"} ${number}.`)}` : "";

  return (
    <section className="urko-opanel" aria-label="Summary">
      <div className="urko-opanel__top">
        <div>
          <div className="urko-opanel__badges">
            <span className={`urko-badge urko-badge--${s.tone}`}>{s.label}</span>
            {kind === "warranty" && (
              <span className={`urko-badge urko-badge--${doc.inWarranty === "yes" ? "g" : doc.inWarranty === "no" ? "r" : "n"}`}>
                {doc.inWarranty === "yes" ? "In warranty" : doc.inWarranty === "no" ? "Warranty ended" : "Warranty not checked"}
              </span>
            )}
            {kind === "return" && doc.changeOfMind && <span className="urko-badge urko-badge--y">Change of mind</span>}
          </div>
          <p className="urko-opanel__help">
            {kind === "warranty"
              ? doc.warrantyEndsAt
                ? `Bought ${doc.purchasedAt ? date(doc.purchasedAt, { dateStyle: "medium" }) : "?"} · warranty ${doc.inWarranty === "yes" ? "until" : "ended"} ${date(doc.warrantyEndsAt, { dateStyle: "medium" })} · ${doc.checkNote ?? ""}`
                : doc.checkNote
              : `${doc.reason ?? ""}${doc.orderNumber ? ` · order ${doc.orderNumber}` : ""}${doc.createdAt ? ` · asked ${timeAgo(doc.createdAt, loc)}` : ""}`}
          </p>
        </div>
        {doc.creditNoteNumber && (
          <div className="urko-opanel__print">
            <a href={`/cms-print/credit-note/${doc.id}`} target="_blank" rel="noreferrer">
              Credit note {doc.creditNoteNumber}
            </a>
          </div>
        )}
      </div>

      {(steps.length > 0 || refund) && (
        <div className="urko-opanel__actions">
          {refund ? (
            <>
              <div className="urko-opanel__ship">
                <label>
                  Refund by
                  <select value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank transfer</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="credit">Store credit</option>
                  </select>
                </label>
                <label>
                  Amount ({money.symbol})
                  <input inputMode={currencyDigits(money.currency) ? "decimal" : "numeric"} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
                </label>
                <label className="urko-opanel__check">
                  <input type="checkbox" checked={refund.restock} onChange={(e) => setRefund({ ...refund, restock: e.target.checked })} /> Put items back in stock
                </label>
              </div>
              <button
                type="button"
                className="urko-btn urko-btn--primary"
                disabled={busy}
                onClick={() => {
                  const amount = Math.max(0, money.round(Number(refund.amount.replace(/[,\s]/g, "")) || 0));
                  void patch({ status: "refunded", refundMethod: refund.method, refundAmount: amount, restock: refund.restock }, `Refunded ${money(amount)} – credit note created`);
                }}
              >
                Save refund
              </button>
              <button type="button" className="urko-btn urko-btn--ghost" onClick={() => setRefund(null)}>
                Back
              </button>
            </>
          ) : (
            steps.map((st) => (
              <button key={st.to + st.label} type="button" className={`urko-btn ${st.primary ? "urko-btn--primary" : st.ask === "reject" ? "urko-btn--ghost" : ""}`} disabled={busy} onClick={() => run(st)}>
                {st.label}
              </button>
            ))
          )}
        </div>
      )}

      <div className="urko-opanel__grid">
        <div className="urko-card">
          <h3>Customer</h3>
          <p className="urko-opanel__strong">{doc.customerName}</p>
          <p>{phone}</p>
          {phone && (
            <div className="urko-opanel__contact">
              <a className="urko-btn" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                Call
              </a>
              <a className="urko-btn" href={wa} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              {doc.order ? (
                <a className="urko-btn" href={`/cms/collections/orders/${doc.order}`}>
                  Open order
                </a>
              ) : null}
            </div>
          )}
        </div>
        <div className="urko-card">
          <h3>{kind === "return" ? "Items" : "Item"}</h3>
          {kind === "warranty" && doc.serial && <p>Serial {doc.serial}</p>}
          {(doc.items ?? []).map((i, n) => (
            <p key={n}>
              {i.title} × {i.qty ?? 1}
              {i.serial ? ` · ${i.serial}` : ""}
              {i.unitPrice ? ` · ${money(i.unitPrice)}` : ""}
            </p>
          ))}
          {doc.refundAmount != null && doc.status === "refunded" && (
            <p className="urko-opanel__collect">
              Refunded <strong>{money(doc.refundAmount)}</strong> by {doc.refundMethod}
              {doc.restocked ? " · back in stock" : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
