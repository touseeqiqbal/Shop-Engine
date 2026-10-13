"use client";
import type { DefaultCellComponentProps } from "payload";

/** Discount list cells: "5% off" / "Rs 1,000 off", amounts in rupees, "3 of 500", and one status badge. */

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const isPast = (t: number) => t < Date.now();

export function DiscountValueCell({ cellData, rowData }: DefaultCellComponentProps) {
  const v = Number(cellData) || 0;
  return <strong>{rowData.kind === "fixed" ? `${rs(v)} off` : `${v}% off`}</strong>;
}

export function MinOrderCell({ cellData }: DefaultCellComponentProps) {
  const v = Number(cellData) || 0;
  return <span>{v > 0 ? `From ${rs(v)}` : "Any order"}</span>;
}

export function UsageCell({ cellData, rowData }: DefaultCellComponentProps) {
  const used = Number(cellData) || 0;
  const limit = Number(rowData.usageLimit) || 0;
  return <span>{limit ? `${used} of ${limit}` : `${used} (no limit)`}</span>;
}

export function DiscountStatusCell({ cellData, rowData }: DefaultCellComponentProps) {
  const expires = rowData.expiresAt ? Date.parse(String(rowData.expiresAt)) : NaN;
  const limit = Number(rowData.usageLimit) || 0;
  const [label, tone] =
    cellData === false
      ? ["Paused", "n"]
      : Number.isFinite(expires) && isPast(expires)
        ? ["Expired", "r"]
        : limit && (Number(rowData.used) || 0) >= limit
          ? ["Used up", "r"]
          : ["Active", "g"];
  return (
    <span className="urko-ocell">
      <span className={`urko-badge urko-badge--${tone}`}>{label}</span>
      {Number.isFinite(expires) && !isPast(expires) && (
        <small>until {new Date(expires).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })}</small>
      )}
    </span>
  );
}
