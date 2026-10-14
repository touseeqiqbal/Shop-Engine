"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SITE_INFO, type SiteInfo } from "@/lib/site-info";

const SiteInfoContext = createContext<SiteInfo>(DEFAULT_SITE_INFO);
const OriginalStoreContext = createContext(true);

/**
 * Provides the live business profile (/cms → Settings → Store details) to client components.
 * `original` = this is the original (default) store, whose built-in logo is that shop's own mark.
 */
export function SiteInfoProvider({ info, original = true, children }: { info: SiteInfo; original?: boolean; children: ReactNode }) {
  return (
    <SiteInfoContext.Provider value={info}>
      <OriginalStoreContext.Provider value={original}>{children}</OriginalStoreContext.Provider>
    </SiteInfoContext.Provider>
  );
}

/** Live store name, phones, address, hours and socials. Falls back to the built-in defaults outside the provider. */
export function useSiteInfo() {
  return useContext(SiteInfoContext);
}

/** Is this the original (default) store? Only it shows the original shop's built-in brand mark. */
export function useIsOriginalStore() {
  return useContext(OriginalStoreContext);
}
