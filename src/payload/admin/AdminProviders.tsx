"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, useTheme } from "@payloadcms/ui";
import { usePathname } from "next/navigation";
import { Toaster } from "./ui/toast";
import { StoreProvider } from "./ui/store-context";

/**
 * - Dark mode by default the first time someone opens the admin (they can still switch to light in Account).
 * - Owners, managers and platform admins without 2-step verification are asked to turn it on before doing anything else.
 * - The store being worked in (and the person's role there) is shared with every screen (StoreProvider).
 */
export function AdminProviders({ children }: { children?: ReactNode }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith("payload-theme="))) setTheme("dark");
  }, [setTheme]);
  return (
    <StoreProvider>
      {children}
      <TwoFactorGate />
      <Toaster />
    </StoreProvider>
  );
}

function TwoFactorGate() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [needed, setNeeded] = useState(false);
  useEffect(() => {
    // the server knows who needs it (owners / managers of any store, platform admins)
    if (!user) return setNeeded(false);
    let live = true;
    fetch("/cms-api/2fa/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { enabled?: boolean; required?: boolean } | null) => live && setNeeded(Boolean(s?.required && !s.enabled)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user, pathname]);
  if (!needed || pathname.startsWith("/cms/security") || pathname.startsWith("/cms/logout")) return null;
  return (
    <div className="urko-dialog__backdrop" role="dialog" aria-modal="true" aria-labelledby="urko-2fa-title">
      <div className="urko-dialog" style={{ maxWidth: 460, padding: 28 }}>
        <h2 id="urko-2fa-title" style={{ marginTop: 0 }}>
          Turn on 2-step verification
        </h2>
        <p>Owners, managers and platform admins can see sales, customers and money, so this account needs a second step at sign-in: a 6-digit code from an app on your phone. It takes about a minute.</p>
        <div className="urko-opanel__contact">
          <a className="urko-btn urko-btn--primary" href="/cms/security">
            Set it up now
          </a>
          <a className="urko-btn" href="/cms/logout">
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
