/** Saved delivery addresses – stored on the user profile (database) or localStorage (demo mode). */
import type { SavedAddress } from "@/lib/types";

export type { SavedAddress };

export const LOCAL_ADDRESSES_KEY = "urko-addresses";

export function readLocalAddresses(): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ADDRESSES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SavedAddress[]).filter((a) => a && typeof a.id === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocalAddresses(list: SavedAddress[]) {
  try {
    window.localStorage.setItem(LOCAL_ADDRESSES_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* storage full / disabled */
  }
}
