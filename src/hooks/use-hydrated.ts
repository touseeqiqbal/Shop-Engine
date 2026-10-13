"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after hydration – use to render values read from localStorage without mismatches. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
