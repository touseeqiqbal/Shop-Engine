"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SITE_INFO, type SiteInfo } from "@/lib/site-info";

const SiteInfoContext = createContext<SiteInfo>(DEFAULT_SITE_INFO);

/** Provides the live business profile (/cms → Settings → Store details) to client components. */
export function SiteInfoProvider({ info, children }: { info: SiteInfo; children: ReactNode }) {
  return <SiteInfoContext.Provider value={info}>{children}</SiteInfoContext.Provider>;
}

/** Live store name, phones, address, hours and socials. Falls back to the built-in defaults outside the provider. */
export function useSiteInfo() {
  return useContext(SiteInfoContext);
}
