import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { NotFoundContent } from "@/components/content/not-found-content";
import { getSiteInfo } from "@/lib/repo/site-content";
import { currentAvailability } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/** Global 404 for URLs outside the storefront layout (rendered inside the root layout only). */
export default async function RootNotFound() {
  const [site, { availability }] = await Promise.all([getSiteInfo(), currentAvailability()]);
  // an address no store owns: no store's name, address or phones
  const unknown = !availability.open && availability.reason === "missing";
  const contact = unknown ? [] : [site.name, site.address.full, ...site.phones.map((p) => p.display)].filter(Boolean);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="container-x flex h-16 items-center">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex-1">
        <NotFoundContent />
      </main>
      {contact.length > 0 && <footer className="border-t border-border py-6 text-center text-xs text-muted">{contact.join(" · ")}</footer>}
    </div>
  );
}
