import type { Metadata } from "next";
import { NotFoundContent } from "@/components/content/not-found-content";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function StoreNotFound() {
  return <NotFoundContent />;
}
