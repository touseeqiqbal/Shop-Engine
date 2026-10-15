"use client";
import { useEffect } from "react";
import { trackEvent } from "@/components/analytics";
import { useStoreLocale } from "@/components/providers/locale";

export interface ListItem {
  item_id: string;
  item_name: string;
  price: number;
}

/** Sends one view_item_list event for a product grid (again only when its products change, e.g. next page). */
export function ListViewEvent({ items }: { items: ListItem[] }) {
  const key = items.map((i) => i.item_id).join(",");
  const { currency } = useStoreLocale();
  useEffect(() => {
    if (!key) return;
    trackEvent("view_item_list", { currency, items: items.map((i, index) => ({ ...i, index })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the list itself changes
  }, [key]);
  return null;
}
