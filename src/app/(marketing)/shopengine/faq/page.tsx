import type { Metadata } from "next";
import Link from "next/link";
import { FaqSearch } from "@/components/marketing/faq-search";
import { CtaBand, PageHero } from "@/components/marketing/sections";
import { FAQS } from "@/lib/marketing/content";
import { breadcrumbLd, faqLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "FAQ", path: "/faq" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Frequently asked questions",
    description: "Answers about ShopEngine: running several stores, web addresses and custom domains, payment methods, point of sale, team access, pricing, trials and international orders.",
    path: "/faq",
  });
}

export default async function FaqPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="Help center" title="Frequently asked questions" lead="Everything you need to know about stores, payments, plans and trials." />
      <section className="relative pb-24 pt-2">
        <div className="mk-container">
          <FaqSearch items={FAQS} />
          <p className="mt-10 text-center text-sm text-body">
            Didn’t find your answer?{" "}
            <Link href="/contact" className="mk-link">
              Contact the ShopEngine team
            </Link>
          </p>
        </div>
      </section>
      <CtaBand />
      {/* the questions and answers are all on this page, so it may carry FAQ markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([faqLd(FAQS), breadcrumbLd(origin, CRUMBS)]) }} />
    </>
  );
}
