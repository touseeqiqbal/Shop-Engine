import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="container-x pb-14 pt-4 sm:pt-8">{children}</div>;
}
