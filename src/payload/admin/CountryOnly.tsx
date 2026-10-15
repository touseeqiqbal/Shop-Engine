"use client";
import type { ComponentProps } from "react";
import { GroupField, SelectField, useField } from "@payloadcms/ui";
import { useAdminLocale } from "./ui/store-context";

/**
 * Settings that only make sense in Pakistan (JazzCash / EasyPaisa, the Pakistani city list): hidden for stores in other
 * countries. Their values stay saved, so nothing is lost if a store's country changes back.
 */

/** The store the settings document belongs to (per-store settings have a `store` field; the original globals don't). */
function useIsPakistan() {
  const { value: store } = useField<unknown>({ path: "store" });
  return useAdminLocale(store ?? undefined).country === "PK";
}

export function PakistanOnlyGroup(props: ComponentProps<typeof GroupField>) {
  return useIsPakistan() ? <GroupField {...props} /> : null;
}

export function PakistanOnlySelect(props: ComponentProps<typeof SelectField>) {
  return useIsPakistan() ? <SelectField {...props} /> : null;
}
