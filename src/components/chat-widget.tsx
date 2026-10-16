"use client";
import { useEffect } from "react";

/**
 * The store's live chat (/cms → Integrations → tawk.to or Crisp). Loads a few seconds after the page so it never
 * slows the store down.
 */
export function ChatWidget({ provider, ids }: { provider: "tawk" | "crisp"; ids: Record<string, string> }) {
  useEffect(() => {
    const clean = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9-]/g, "");
    const t = setTimeout(() => {
      if (document.querySelector('script[data-se="chat"]')) return;
      const s = document.createElement("script");
      s.dataset.se = "chat";
      s.async = true;
      if (provider === "tawk") {
        const property = clean(ids.propertyId);
        const widget = clean(ids.widgetId) || "default";
        if (!property) return;
        (window as unknown as { Tawk_API?: object; Tawk_LoadStart?: Date }).Tawk_API ??= {};
        (window as unknown as { Tawk_LoadStart?: Date }).Tawk_LoadStart = new Date();
        s.src = `https://embed.tawk.to/${property}/${widget}`;
        s.charset = "UTF-8";
        s.setAttribute("crossorigin", "*");
      } else {
        const website = clean(ids.websiteId);
        if (!website) return;
        const w = window as unknown as { $crisp?: unknown[]; CRISP_WEBSITE_ID?: string };
        w.$crisp = [];
        w.CRISP_WEBSITE_ID = website;
        s.src = "https://client.crisp.chat/l.js";
      }
      document.head.appendChild(s);
    }, 3500);
    return () => clearTimeout(t);
  }, [provider, ids]);
  return null;
}
