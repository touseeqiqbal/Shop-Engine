"use client";
import Link from "next/link";
import type { DefaultCellComponentProps } from "payload";
import { useAdminLocale, useAdminMoney } from "../ui/store-context";
import { ORDER_STATUS, PAYMENT_STATUS, timeAgo } from "./status";
import { paymentLabel } from "../../../lib/order-display";

/** Order list cells: number + when, customer, coloured status, payment, amount (in the order's own currency). */

export function OrderNumberCell({ rowData, cellData }: DefaultCellComponentProps) {
  const loc = useAdminLocale(rowData.store);
  return (
    <Link className="urko-ocell" href={`/cms/collections/orders/${rowData.id}`}>
      <strong>{String(cellData ?? "")}</strong>
      <small>{timeAgo(String(rowData.placedAt ?? rowData.createdAt ?? ""), loc)}</small>
    </Link>
  );
}

export function OrderCustomerCell({ cellData }: DefaultCellComponentProps) {
  const c = (cellData ?? {}) as { name?: string; city?: string; phone?: string };
  return (
    <span className="urko-ocell">
      <strong>{c.name || "—"}</strong>
      <small>{[c.city, c.phone].filter(Boolean).join(" · ")}</small>
    </span>
  );
}

export function OrderStatusCell({ cellData }: DefaultCellComponentProps) {
  const s = ORDER_STATUS[String(cellData)] ?? { label: String(cellData ?? "—"), tone: "n" };
  return <span className={`urko-badge urko-badge--${s.tone}`}>{s.label}</span>;
}

export function OrderPaymentCell({ cellData, rowData }: DefaultCellComponentProps) {
  const s = PAYMENT_STATUS[String(cellData)] ?? { label: String(cellData ?? "—"), tone: "n" };
  return (
    <span className="urko-ocell">
      <span className={`urko-badge urko-badge--${s.tone}`}>{s.label}</span>
      <small>{paymentLabel(typeof rowData.paymentMethod === "string" ? rowData.paymentMethod : "", typeof rowData.paymentMethodLabel === "string" ? rowData.paymentMethodLabel : null)}</small>
    </span>
  );
}

export function OrderTotalCell({ cellData, rowData }: DefaultCellComponentProps) {
  const money = useAdminMoney(rowData.store, (rowData as { currency?: string }).currency);
  const items = Array.isArray(rowData.items) ? (rowData.items as { qty?: number }[]).reduce((n, i) => n + (Number(i.qty) || 0), 0) : 0;
  return (
    <span className="urko-ocell urko-ocell--num">
      <strong>{money(Number(cellData) || 0)}</strong>
      {items > 0 && (
        <small>
          {items} item{items === 1 ? "" : "s"}
        </small>
      )}
    </span>
  );
}
