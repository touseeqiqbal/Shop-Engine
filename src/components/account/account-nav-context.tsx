"use client";

import { createContext, useContext } from "react";

/**
 * Whether the account nav shows "Manage stores" (ShopEngine's store management): on ShopEngine's own address, or for
 * someone who works in a store. A shop's customers never see it. Set once by the account layout.
 */
const ShowStores = createContext(false);

export function AccountNavProvider({ showStores, children }: { showStores: boolean; children: React.ReactNode }) {
  return <ShowStores.Provider value={showStores}>{children}</ShowStores.Provider>;
}

export const useShowStores = () => useContext(ShowStores);
