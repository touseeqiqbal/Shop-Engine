import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, Building2, CalendarClock, CreditCard, FileCheck2, Laptop, MessageCircle } from "lucide-react";
import { PolicyLayout } from "@/components/content/policy-layout";
import { FaqAccordion } from "@/components/content/faq-accordion";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { JsonLd } from "@/components/ui/json-ld";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { waLink } from "@/lib/site";
import { primaryPhone, storePlace } from "@/lib/site-info";
import { faqJsonLd } from "@/lib/seo";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { getConversionSettings } from "@/lib/cms/engagement";
import { countryInText } from "@/lib/locale";
import { moneyFormatter } from "@/lib/money";
import { getStoreLocale } from "@/lib/store-locale";
import type { FaqItem } from "@/lib/types";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/installments");
}

// `place` = where the store is, e.g. "Saddar, Karachi" (Settings → Store details)
const steps = (place: string) => [
  {
    icon: Laptop,
    title: "Choose your laptop",
    text: `Pick any eligible laptop or bundle on our website or at our ${place ? `${place} ` : ""}shop.`,
  },
  {
    icon: CreditCard,
    title: "Select instalments at checkout",
    text: "Choose your bank and a 3, 6 or 12-month plan when paying by eligible credit card.",
  },
  {
    icon: FileCheck2,
    title: "Bank approval",
    text: "Your bank converts the purchase into monthly instalments – no extra paperwork with us.",
  },
  {
    icon: CalendarClock,
    title: "Pay monthly",
    text: "Receive your laptop with full warranty and pay the bank in easy monthly instalments.",
  },
];

const BANKS = ["Credit card instalments", "Shariah-compliant plans", "0% markup tenures", "3 / 6 / 12-month plans", "Buy now, pay later", "Corporate & bulk plans"];

/** FAQs once plans are switched on in /cms → Settings → Installments & reminders. */
const LIVE_FAQS: FaqItem[] = [
  {
    q: "How do I buy a laptop on installments?",
    a: "Choose your laptop, then message us on WhatsApp with the bank and number of months from the table on this page. We confirm the price and the bank turns the payment into monthly installments.",
  },
  {
    q: "Which laptops can I buy on installments?",
    a: "Orders from the amount shown next to each plan. Ask us on WhatsApp if you're not sure whether a laptop qualifies.",
  },
  {
    q: "Is there markup on installment plans?",
    a: "The markup for each bank and number of months is shown in the table. Some banks also charge their own processing fee – they tell you before you confirm.",
  },
  {
    q: "Do I need a credit card?",
    a: "Most bank plans work with an eligible credit card from that bank. Message us and we'll tell you what your bank offers.",
  },
];

/** `pk` = a store in Pakistan (its amounts are in rupees). */
const FAQS = (pk: boolean): FaqItem[] => [
  {
    q: "Can I buy a laptop on installments right now?",
    a: "Bank instalment plans are not live yet. Until they launch, message us on WhatsApp – we can suggest budget options, reserve a laptop with a small advance, or let you know as soon as instalments become available.",
  },
  {
    q: "Which laptops will be available on installments?",
    a: `We plan to offer instalments on most new and refurbished laptops${pk ? " above Rs 50,000" : ""}, and on selected bundles. Eligibility will be shown on each product page.`,
  },
  {
    q: "Will there be markup on installment plans?",
    a: "Some banks offer 0% instalment plans on selected tenures, while others charge a processing fee or markup. Exact terms will be shown clearly before you confirm your order.",
  },
  {
    q: "Do I need a credit card?",
    a: "The first plans will work with eligible bank credit cards. We are also exploring options for customers without a credit card.",
  },
];

export default async function InstallmentsPage() {
  const [c, conversion, loc] = await Promise.all([getResolvedPageContent("/installments"), getConversionSettings(), getStoreLocale()]);
  const money = moneyFormatter(loc);
  const pk = loc.country === "PK";
  const plans = conversion.emiEnabled ? conversion.emiPlans : [];
  // the page talks about plans as "coming soon" only while none are switched on
  const live = plans.length > 0;
  const faqs = live ? LIVE_FAQS : FAQS(pk);
  return (
    <PolicyLayout path="/installments" name="Installment Plans" eyebrow={c.eyebrow || undefined} title={<InlineText text={c.title} />} description={c.description} updated={c.updated}>
      <JsonLd data={faqJsonLd(faqs)} />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-violet-600/15 p-6 sm:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-500/20 text-amber-400">
              <BadgePercent className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-fg">{live ? "Pay in easy monthly installments" : "Installment plans are launching soon"}</h2>
              <p className="mt-1 text-sm text-muted">
                {live ? "Pick a bank and a number of months below – message us on WhatsApp and we'll set it up for you." : "Want to be first in line? Send us a WhatsApp and we'll notify you the moment plans go live."}
              </p>
            </div>
          </div>
          <a
            href={waLink(primaryPhone(c.info).wa, live ? `Hi ${c.info.name}! I'd like to buy a laptop on installments.` : `Hi ${c.info.name}! Please notify me when laptop installment plans are available.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp shrink-0"
          >
            <WhatsAppIcon className="size-4" /> {live ? "Ask on WhatsApp" : "Notify me"}
          </a>
        </div>
      </div>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-5 text-2xl font-bold text-fg">
          {live ? "How it works" : "How it will work"}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps(storePlace(c.info)).map((s, i) => (
            <li key={s.title} className="card relative p-5">
              <span className="absolute right-5 top-4 font-display text-3xl font-bold text-fg/10">{i + 1}</span>
              <s.icon className="size-6 text-sky-400" aria-hidden="true" />
              <h3 className="mt-3 font-bold text-fg">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {c.body.trim() && <Markdown content={c.body} className="card p-6 sm:p-10" />}

      <section aria-labelledby="banks-heading">
        <h2 id="banks-heading" className="mb-2 text-2xl font-bold text-fg">
          Partner banks
        </h2>
        {plans.length > 0 ? (
          <>
            <p className="mb-5 text-sm text-muted">{conversion.emiNote}</p>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="p-3 font-medium">Bank</th>
                    <th className="p-3 font-medium">Months</th>
                    <th className="p-3 font-medium">Markup</th>
                    <th className="p-3 font-medium">From order of</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={`${p.bank}-${p.months}`} className="border-t border-border">
                      <td className="p-3 font-semibold text-fg">{p.bank}</td>
                      <td className="p-3">{p.months}</td>
                      <td className="p-3">{p.markupPercent ? `${p.markupPercent}%` : "0%"}</td>
                      <td className="p-3">{p.minAmount ? money(p.minAmount) : "Any"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted">We&apos;re finalising partnerships with banks in {countryInText(loc.country)}. Partner names, eligible cards and exact terms will be announced at launch.</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BANKS.map((b) => (
                <li key={b} className="card flex flex-col items-center justify-center gap-1 p-5 text-center">
                  <Building2 className="size-5 text-muted" aria-hidden="true" />
                  <span className="font-display font-bold text-fg">{b}</span>
                  <span className="chip mt-1 text-[10px] text-amber-400">Coming soon</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="meanwhile-heading" className="card p-6 sm:p-8">
        <h2 id="meanwhile-heading" className="text-xl font-bold text-fg">
          Need a laptop now on a tight budget?
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>
              Browse our{" "}
              <Link href="/category/budget-laptops" className="font-semibold text-fg underline-offset-4 hover:underline">
                {pk ? "budget laptops under Rs 100,000" : "budget laptops"}
              </Link>{" "}
              and{" "}
              <Link href="/category/used-refurbished-laptops" className="font-semibold text-fg underline-offset-4 hover:underline">
                used & refurbished laptops
              </Link>{" "}
              – Core i5 performance for much less.
            </span>
          </li>
          {/* the rupee buying guide is written for Pakistan */}
          {pk && (
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>
                Read our{" "}
                <Link href="/blog/best-laptops-under-100000-pakistan" className="font-semibold text-fg underline-offset-4 hover:underline">
                  best laptops under Rs 100,000
                </Link>{" "}
                guide.
              </span>
            </li>
          )}
          <li className="flex gap-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>Pay with Cash on Delivery {pk ? "anywhere in Pakistan" : "nationwide"} – no card needed.</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="inst-faq-heading">
        <h2 id="inst-faq-heading" className="mb-4 text-2xl font-bold text-fg">
          Installment FAQs
        </h2>
        <FaqAccordion items={faqs} />
      </section>
    </PolicyLayout>
  );
}
