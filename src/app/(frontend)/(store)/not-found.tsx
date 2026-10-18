import type { Metadata } from "next";
import { NotFoundContent } from "@/components/content/not-found-content";
import { storeNotFoundCategories } from "@/components/content/store-not-found-categories";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default async function StoreNotFound() {
  // this store's own categories – not the original shop's
  return <NotFoundContent categories={await storeNotFoundCategories()} />;
}
