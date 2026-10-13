"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCw } from "lucide-react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { waLink } from "@/lib/site";
import { useSiteInfo } from "@/components/providers/site-info";
import { primaryPhone } from "@/lib/site-info";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const site = useSiteInfo();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="card relative max-w-xl overflow-hidden p-8 text-center sm:p-12" role="alert">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-rose-600/20 blur-3xl" aria-hidden="true" />
        <span className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-rose-500/15 text-rose-400">
          <AlertTriangle className="size-8" aria-hidden="true" />
        </span>
        <h1 className="relative mt-6 text-2xl font-bold text-fg sm:text-3xl">Something went wrong</h1>
        <p className="relative mt-3 text-muted">
          Sorry – this page hit a snag. Please try again. If it keeps happening, message us on WhatsApp and we&apos;ll help you place your order.
        </p>
        {error.digest && <p className="relative mt-2 font-mono text-xs text-subtle">Error ref: {error.digest}</p>}
        <div className="relative mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCw className="size-4" aria-hidden="true" /> Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home className="size-4" aria-hidden="true" /> Home
          </Link>
          <a href={waLink(primaryPhone(site).wa, "Hi! Your website showed an error. Can you help?")} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            <WhatsAppIcon className="size-4" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
