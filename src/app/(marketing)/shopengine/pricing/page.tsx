import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing";
import { CtaBand, FaqList, PageHero } from "@/components/marketing/sections";
import { FAQS } from "@/lib/marketing/content";
import { ALL_FEATURES, FEATURE_LABEL, pricingPlans } from "@/lib/marketing/plans";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

export const revalidate = 300;

const CRUMBS = [{ name: "Pricing", path: "/pricing" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Pricing",
    description: "ShopEngine plans: every store on its own plan with a free trial, product and team limits, and features such as your own domain, card payments and the shop counter.",
    path: "/pricing",
  });
}

const INCLUDED = [
  "Your own store address on the ShopEngine domain",
  "Products, variants, stock and categories",
  "Orders, partial shipments, returns and invoices",
  "Cash on delivery, bank transfer and your own local payment methods",
  "Delivery zones per country, with delivery times and free-delivery thresholds",
  "Team roles and two-step verification for owners and managers",
  "Order emails, and WhatsApp / SMS through the providers you connect",
  "Sales dashboard in your store's currency and time zone",
];

export default async function PricingPage() {
  const [plans, origin] = await Promise.all([pricingPlans(), marketingOrigin()]);
  const configured = plans.some((p) => p.configured);
  const billingFaqs = FAQS.filter((f) => f.group === "Plans" || f.q.startsWith("Can I use my own domain"));
  return (
    <>
      <PageHero center crumbs={CRUMBS} eyebrow="Pricing" title={<>Simple plans for <span className="mk-gradient-text">every stage</span></>} lead="Every store is on its own plan, so each business pays for what it uses. Each plan shows its free trial, limits and features – and you can change plans whenever you need to." />

      <section className="relative pb-24">
        <div className="mk-container">
          <PricingCards plans={plans} />
          {!configured && <p className="mt-8 text-center text-sm text-faint">Plan prices and limits are set by ShopEngine and shown here once they are published.</p>}
          {configured && <p className="mt-8 text-center text-sm text-faint">Prices are per store. Owners change or cancel a store’s plan under “Your stores” – a cancelled plan runs to the end of the paid period.</p>}
        </div>
      </section>

      {configured && plans.length > 1 && (
        <section className="pb-24" aria-labelledby="compare">
          <div className="mk-container">
            <h2 id="compare" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
              Compare plans
            </h2>
            <div className="mk-card mt-8 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Plan comparison</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-4 font-semibold text-faint">
                      Plan
                    </th>
                    {plans.map((p) => (
                      <th key={p.key} scope="col" className="p-4 font-semibold text-ink">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <th scope="row" className="p-4 font-medium text-body">
                      Monthly price
                    </th>
                    {plans.map((p) => (
                      <td key={p.key} className="p-4 text-ink">
                        {p.price ?? "–"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-body">
                      Free trial
                    </th>
                    {plans.map((p) => (
                      <td key={p.key} className="p-4 text-ink">
                        {p.trial ?? "–"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-body">
                      Products
                    </th>
                    {plans.map((p) => (
                      <td key={p.key} className="p-4 text-ink">
                        {p.products}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-body">
                      Team members
                    </th>
                    {plans.map((p) => (
                      <td key={p.key} className="p-4 text-ink">
                        {p.team}
                      </td>
                    ))}
                  </tr>
                  {ALL_FEATURES.map((f) => (
                    <tr key={f}>
                      <th scope="row" className="p-4 font-medium text-body">
                        {FEATURE_LABEL[f]}
                      </th>
                      {plans.map((p) => (
                        <td key={p.key} className="p-4">
                          {p.features.includes(f) ? <Check className="size-4 text-ok" aria-label="Included" /> : <Minus className="size-4 text-white/20" aria-label="Not included" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="pb-24" aria-labelledby="included">
        <div className="mk-container grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="included" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
              Included on every plan
            </h2>
            <p className="mk-text mt-3">The essentials for running a store are never an add-on.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((t) => (
              <li key={t} className="flex gap-2.5 text-[0.9375rem] text-ink-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-section border-y border-white/[0.06] bg-canvas/60" aria-labelledby="billing-faq">
        <div className="mk-container">
          <h2 id="billing-faq" className="mk-h2 text-center text-[clamp(1.9rem,3.4vw,2.75rem)]">
            Billing questions
          </h2>
          <FaqList items={billingFaqs} className="mx-auto mt-10 max-w-3xl" />
          <p className="mt-8 text-center text-sm text-body">
            Need something different?{" "}
            <Link href="/contact" className="mk-link">
              Talk to us
            </Link>
          </p>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
