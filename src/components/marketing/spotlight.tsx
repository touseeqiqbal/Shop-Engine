"use client";
import { useEffect } from "react";

/** Moves the soft light on `.mk-spot` cards with the pointer (one listener for the whole page; nothing on touch screens). */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".mk-spot") as HTMLElement | null;
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}
