import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHero } from "./page-hero";
import { WhatsAppCta } from "./whatsapp-cta";
import { getStoreLocale } from "@/lib/store-locale";
import { cn, formatDate } from "@/lib/utils";

export const POLICY_PAGES = [
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/warranty-returns", label: "Warranty & Returns" },
  { href: "/installments", label: "Installment Plans" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/faqs", label: "FAQs" },
];

/** Two-column layout for policy pages: hero + content + sticky "other policies" nav. */
export async function PolicyLayout({
  path,
  name,
  eyebrow,
  title,
  description,
  updated,
  children,
}: {
  path: string;
  name: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  updated: string;
  children: ReactNode;
}) {
  const { locale } = await getStoreLocale();
  return (
    <div className="pb-16">
      <PageHero crumbs={[{ name, href: path }]} eyebrow={eyebrow ?? "Policies"} title={title} description={description}>
        <p className="mt-5 text-xs text-subtle">
          {/* `updated` is a calendar day (YYYY-MM-DD): shown in the store's language, never shifted by a time zone */}
          Last updated: <time dateTime={updated}>{formatDate(updated, { dateStyle: "long", timeZone: "UTC" }, { locale })}</time>
        </p>
      </PageHero>
      <div className="container-x mt-8 grid gap-10 sm:mt-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14">
        <div className="min-w-0 space-y-10">{children}</div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Store policies" className="card p-5">
            <p className="mb-3 text-sm font-semibold text-fg">Store policies</p>
            <ul className="space-y-1">
              {POLICY_PAGES.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    aria-current={p.href === path ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      p.href === path ? "bg-surface-strong font-semibold text-fg" : "text-muted hover:bg-surface-strong hover:text-fg"
                    )}
                  >
                    <FileText className="size-4" aria-hidden="true" /> {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
      <div className="container-x mt-14">
        <WhatsAppCta title="Questions about this policy?" text="Message or call our team – we're happy to explain anything before you order." message="Hi {store}! I have a question about your policies." />
      </div>
    </div>
  );
}
