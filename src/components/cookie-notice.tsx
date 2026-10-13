"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Cookie / analytics notice. The choice is kept for a year in the "urko-consent" cookie.
 * Accept → Google consent mode is updated to "granted" and the Meta Pixel is allowed to load (event "urko:consent").
 */

export type CookieNoticeText = { message: string; acceptLabel: string; rejectLabel: string; policyLink: string };

export const CONSENT_COOKIE = "urko-consent";
export const readConsent = () => (typeof document === "undefined" ? null : (document.cookie.match(/(?:^|; )urko-consent=(granted|denied)/)?.[1] ?? null));

function choose(value: "granted" | "denied") {
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${365 * 864e2}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  w.gtag?.("consent", "update", { analytics_storage: value, ad_storage: value, ad_user_data: value, ad_personalization: value });
  window.dispatchEvent(new CustomEvent("urko:consent", { detail: value }));
}

export function CookieNotice({ text }: { text: CookieNoticeText }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!readConsent()) setOpen(true);
  }, []);
  if (!open) return null;
  return (
    <div role="region" aria-label="Cookie notice" data-float="cookie" className="fixed inset-x-3 bottom-[calc(var(--mobile-nav)+1rem)] z-50 mx-auto max-w-2xl rounded-2xl border border-border-strong bg-bg-elevated/95 p-4 shadow-2xl backdrop-blur lg:bottom-4">
      <p className="text-sm text-muted">
        {text.message}{" "}
        {text.policyLink && (
          <Link href={text.policyLink} className="font-semibold text-fg underline">
            Learn more
          </Link>
        )}
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            choose("denied");
            setOpen(false);
          }}
        >
          {text.rejectLabel}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            choose("granted");
            setOpen(false);
          }}
        >
          {text.acceptLabel}
        </button>
      </div>
    </div>
  );
}
