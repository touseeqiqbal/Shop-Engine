"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CHROME, type Chrome } from "@/lib/cms/chrome-types";

const ChromeContext = createContext<Chrome>(DEFAULT_CHROME);

/** Online-store settings from Payload (theme, header, WhatsApp button…) for client components. */
export function ChromeProvider({ chrome, children }: { chrome: Chrome; children: ReactNode }) {
  return <ChromeContext.Provider value={chrome}>{children}</ChromeContext.Provider>;
}

export function useChrome() {
  return useContext(ChromeContext);
}
