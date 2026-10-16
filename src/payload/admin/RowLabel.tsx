"use client";
import { useRowLabel } from "@payloadcms/ui";
import { useAdminMoney } from "./ui/store-context";

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

type ZoneRow = { name?: string; rest?: boolean; charge?: number; cities?: string[]; places?: string[]; countries?: string[] };
/** Shipping zone: "Karachi · Rs 200 · 1 city" */
export function ZoneRowLabel() {
  const { data, rowNumber } = useRowLabel<ZoneRow>();
  const money = useAdminMoney();
  const parts = [data?.name || `Zone ${String((rowNumber ?? 0) + 1).padStart(2, "0")}`];
  if (typeof data?.charge === "number") parts.push(money(data.charge));
  const cities = data?.cities?.length ?? 0;
  const n = cities + (data?.places?.length ?? 0);
  const noun = n === cities ? (n === 1 ? "city" : "cities") : n === 1 ? "place" : "places";
  // a zone abroad names its countries
  if (data?.countries?.length) parts.push(data.countries.join(", "));
  parts.push(data?.rest ? "all other addresses" : `${n} ${noun}`);
  return <span>{parts.join(" · ")}</span>;
}

type MethodRow = { name?: string; enabled?: boolean; due?: string };
/** A store's own payment method: "UPI · before shipping" / "Card on delivery · on delivery · off" */
export function PaymentMethodRowLabel() {
  const { data, rowNumber } = useRowLabel<MethodRow>();
  const parts = [data?.name || `Method ${String((rowNumber ?? 0) + 1).padStart(2, "0")}`, data?.due === "on-delivery" ? "on delivery" : "before shipping"];
  if (data?.enabled === false) parts.push("off");
  return <span>{parts.join(" · ")}</span>;
}
