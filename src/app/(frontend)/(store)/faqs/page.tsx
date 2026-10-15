import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/content/page-hero";
import { FaqAccordion } from "@/components/content/faq-accordion";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { JsonLd } from "@/components/ui/json-ld";
import { getFaqs } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { storePlace } from "@/lib/site-info";
import { faqJsonLd } from "@/lib/seo";
import { getPageMeta } from "@/lib/page-seo";
import { slugify } from "@/lib/utils";
import type { FaqItem } from "@/lib/types";
import { getStoreLocale } from "@/lib/store-locale";
import { deliveryArea } from "@/lib/locale";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/faqs");
}

export default async function FaqsPage() {
  const [faqs, site, { country }] = await Promise.all([getFaqs(), getSiteInfo(), getStoreLocale()]);
  const place = storePlace(site); // where the store is (Settings → Store details)
  const groups = new Map<string, FaqItem[]>();
  for (const f of faqs) {
    const g = f.group || "General";
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }

  return (
    <div className="pb-16">
      <JsonLd data={faqJsonLd(faqs)} />
      <PageHero
        crumbs={[{ name: "FAQs", href: "/faqs" }]}
        eyebrow="Help centre"
        title={
          <>
            Frequently asked <span className="gradient-text">questions</span>
          </>
        }
        description={`Everything you need to know about ordering laptops and accessories from our ${place ? `${place} ` : ""}store – with delivery ${deliveryArea(country)}.`}
      />

      <div className="container-x mt-8 grid gap-10 sm:mt-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="FAQ topics" className="lg:sticky lg:top-28 lg:self-start">
          <p className="mb-3 hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted lg:block">Topics</p>
          <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
            {[...groups.keys()].map((g) => (
              <li key={g} className="shrink-0">
                <a href={`#${slugify(g)}`} className="chip whitespace-nowrap text-muted hover:text-fg lg:flex lg:w-full lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:text-sm lg:hover:bg-surface-strong">
                  {g} <span className="opacity-60">{groups.get(g)!.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          {[...groups.entries()].map(([g, items]) => (
            <section key={g} id={slugify(g)} aria-labelledby={`${slugify(g)}-heading`} className="scroll-mt-28">
              <h2 id={`${slugify(g)}-heading`} className="mb-4 text-2xl font-bold text-fg">
                {g}
              </h2>
              <FaqAccordion items={items} />
            </section>
          ))}

          <p className="text-sm text-muted">
            Still have a question? Read our <Link href="/shipping-policy" className="font-semibold text-fg underline-offset-4 hover:underline">shipping policy</Link>,{" "}
            <Link href="/warranty-returns" className="font-semibold text-fg underline-offset-4 hover:underline">warranty & returns</Link> or{" "}
            <Link href="/contact" className="font-semibold text-fg underline-offset-4 hover:underline">contact us</Link>.
          </p>
          <WhatsAppCta title="Didn't find your answer?" message="Hi {store}! I have a question about an order." />
        </div>
      </div>
    </div>
  );
}
