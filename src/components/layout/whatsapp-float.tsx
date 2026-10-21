"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { X } from "lucide-react";
import { WhatsAppIcon } from "./whatsapp-icon";
import { waLink } from "@/lib/site";
import { useSiteInfo } from "@/components/providers/site-info";
import { useChrome } from "@/components/providers/chrome";
import { cn } from "@/lib/utils";

/**
 * Floating WhatsApp button (/cms → Online store → WhatsApp button). Numbers and note fall back to Store info.
 * One number opens the chat directly; several let the shopper choose.
 */
export function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const site = useSiteInfo(); // live business profile (/cms → Settings → Store details)
  const { whatsapp } = useChrome();
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // the list of numbers: focus moves to the first one; Escape (back to the button) or a tap outside closes it
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => wrap.current?.querySelector<HTMLElement>("[role='dialog'] a")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  if (!whatsapp.enabled) return null;
  const numbers = whatsapp.numbers.length ? whatsapp.numbers : site.phones;
  const note = whatsapp.note || site.whatsappNote;
  const message = whatsapp.message || `Hi ${site.name}! I need help with an order.`;
  const left = whatsapp.position === "left";
  const buttonClass =
    "relative grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-6px_rgba(37,211,102,0.7)] transition hover:scale-105";

  return (
    <div ref={wrap} data-float="whatsapp" className={cn("fixed bottom-[calc(var(--mobile-nav)+1rem)] z-40 flex flex-col gap-3 lg:bottom-6", left ? "left-4 items-start lg:left-6" : "right-4 items-end lg:right-6")}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="glass w-72 rounded-3xl p-4 shadow-2xl"
            role="dialog"
            aria-label="Chat on WhatsApp"
          >
            <p className="font-semibold">Chat with {site.name}</p>
            <p className="mt-0.5 text-xs text-muted">{note}</p>
            <ul className="mt-3 space-y-2">
              {numbers.map((p) => (
                <li key={p.wa}>
                  <a
                    href={waLink(p.wa, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl bg-surface-strong px-3 py-2.5 transition hover:bg-emerald-500/15"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-[#25D366] text-white">
                      <WhatsAppIcon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{p.label}</span>
                      <span className="block text-xs text-muted">{p.display}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {numbers.length === 1 ? (
        <a href={waLink(numbers[0].wa, message)} target="_blank" rel="noopener noreferrer" aria-label={`Chat on WhatsApp ${numbers[0].display}`} className={buttonClass}>
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" aria-hidden="true" />
          <WhatsAppIcon className="size-7" />
        </a>
      ) : (
        <button
          ref={toggle}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close WhatsApp chat options" : "Chat on WhatsApp"}
          className={buttonClass}
        >
          {!open && <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" aria-hidden="true" />}
          {open ? <X className="size-6" aria-hidden="true" /> : <WhatsAppIcon className="size-7" />}
        </button>
      )}
    </div>
  );
}
