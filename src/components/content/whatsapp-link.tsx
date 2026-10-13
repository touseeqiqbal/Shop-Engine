"use client";
import type { ReactNode } from "react";
import { useSiteInfo } from "@/components/providers/site-info";
import { primaryPhone } from "@/lib/site-info";
import { waLink } from "@/lib/site";

/** <a> to the store's primary WhatsApp number (live from /cms → Settings → Store details) with a prefilled message. */
export function WhatsAppLink({ message, className, children }: { message?: string; className?: string; children: ReactNode }) {
  const site = useSiteInfo();
  return (
    <a href={waLink(primaryPhone(site).wa, message)} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
