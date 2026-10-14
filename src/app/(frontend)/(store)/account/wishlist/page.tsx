import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-ui";
import { WishlistView } from "@/components/account/wishlist-view";
import { getSessionUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getSiteInfo(); // the current store's own name
  return pageMetadata({
    title: `My Wishlist | ${name}`,
    description: "Laptops and accessories you saved for later.",
    path: "/account/wishlist",
    noindex: true,
  });
}

export default async function WishlistPage() {
  const user = isDatabaseConfigured ? await getSessionUser().catch(() => null) : null;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        My <span className="gradient-text">wishlist</span>
      </h1>
      <AccountNav />
      <WishlistView signedIn={!!user} />
    </div>
  );
}
