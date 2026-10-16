import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: { absolute: "Page not found | ShopEngine" }, robots: { index: false, follow: true } };

/** Any other address on the marketing site → its own "page not found" (./not-found.tsx), inside the site's layout. */
export default function Missing() {
  notFound();
}
