import type { Metadata } from "next";
import { AccountNavProvider } from "@/components/account/account-nav-context";
import { getSessionUser } from "@/lib/auth";
import { worksInAnyStore } from "@/lib/store-tenant";
import { isPlatformRequest } from "@/lib/tenant";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // ShopEngine's store management in the account nav: on ShopEngine's own address, or for someone who works in a store
  const [platform, user] = await Promise.all([isPlatformRequest().catch(() => false), getSessionUser().catch(() => null)]);
  const showStores = platform || (user ? await worksInAnyStore(user.id).catch(() => false) : false);
  return (
    <AccountNavProvider showStores={showStores}>
      <div className="container-x pb-14 pt-4 sm:pt-8">{children}</div>
    </AccountNavProvider>
  );
}
