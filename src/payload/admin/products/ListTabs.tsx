"use client";
import { ListTabs } from "../ui/ListTabs";

const TABS = [
  { label: "All", where: "" },
  { label: "On store", where: "where[status][equals]=active" },
  { label: "Drafts", where: "where[status][equals]=draft" },
  { label: "Low stock", where: "where[stockStatus][equals]=low" },
  { label: "Out of stock", where: "where[stockStatus][equals]=out" },
  { label: "Hidden", where: "where[status][equals]=archived" },
  { label: "Variants", where: "where[variantOf][exists]=true" },
];

export function ProductListTabs() {
  return <ListTabs label="Product views" tabs={TABS} tip="Tip: click a price or stock number to change it right here. Tick several products to change them together." />;
}
