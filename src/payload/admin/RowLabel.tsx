"use client";
import { useRowLabel } from "@payloadcms/ui";

type LinkRow = { type?: string; label?: string; url?: string; megaMenu?: boolean };

/** Shows a menu item's label (or its URL / type) instead of "Item 01" in the admin. */
export function MenuRowLabel() {
  const { data, rowNumber } = useRowLabel<LinkRow>();
  const name = data?.label || data?.url || (data?.type && data.type !== "custom" ? `(${data.type} link)` : "");
  return (
    <span>
      {name || `Item ${String((rowNumber ?? 0) + 1).padStart(2, "0")}`}
      {data?.megaMenu ? " · mega menu" : ""}
    </span>
  );
}

type ColumnRow = { title?: string };
export function TitleRowLabel() {
  const { data, rowNumber } = useRowLabel<ColumnRow>();
  return <span>{data?.title || `Row ${String((rowNumber ?? 0) + 1).padStart(2, "0")}`}</span>;
}

type ZoneRow = { name?: string; rest?: boolean; charge?: number; cities?: string[] };
/** Shipping zone: "Karachi · Rs 200 · 1 city" */
export function ZoneRowLabel() {
  const { data, rowNumber } = useRowLabel<ZoneRow>();
  const parts = [data?.name || `Zone ${String((rowNumber ?? 0) + 1).padStart(2, "0")}`];
  if (typeof data?.charge === "number") parts.push(`Rs ${data.charge.toLocaleString("en-PK")}`);
  const n = data?.cities?.length ?? 0;
  parts.push(data?.rest ? "all other cities" : `${n} ${n === 1 ? "city" : "cities"}`);
  return <span>{parts.join(" · ")}</span>;
}
