"use client";
import { useEffect } from "react";

/**
 * A page with a sticky bottom bar on phones (checkout, cart): while it is shown, the floating WhatsApp button and the
 * cookie notice move up above it (globals.css – html[data-sticky-bar]), so they never cover its button.
 */
export function useStickyBar(active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.stickyBar = "1";
    return () => {
      delete root.dataset.stickyBar;
    };
  }, [active]);
}
