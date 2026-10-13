import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CartView } from "@/components/checkout/cart-view";
import { getStoreSettings } from "@/lib/repo/catalog";
import { getPageMeta } from "@/lib/page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/cart");
}

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <div className="container-x pb-12 pt-4 sm:pt-6">
      <Breadcrumbs items={[{ name: "Cart", href: "/cart" }]} />
      <h1 className="mb-6 mt-3 font-display text-3xl font-bold sm:text-4xl">
        Your <span className="gradient-text">cart</span>
      </h1>
      <CartView settings={settings} />
    </div>
  );
}
