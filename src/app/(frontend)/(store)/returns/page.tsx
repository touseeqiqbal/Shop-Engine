import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/content/page-hero";
import { AfterSalesForms } from "@/components/aftersales/aftersales-forms";
import { getReturnsPolicy } from "@/lib/cms/aftersales";
import { getPageMeta } from "@/lib/page-seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  // title & description editable in /cms → Settings → Google & SEO → Built-in pages
  return getPageMeta("/returns");
}

/** Customer return request and warranty claim forms. Rules come from Settings → Returns & warranty rules. */
export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [policy, { type }] = await Promise.all([getReturnsPolicy(), searchParams]);
  return (
    <div className="pb-16">
      <PageHero
        crumbs={[{ name: "Returns & warranty", href: "/returns" }]}
        eyebrow="After-sales"
        title={
          <>
            Return an item or <span className="gradient-text">claim warranty</span>
          </>
        }
        description={`Returns within ${policy.returnDays} day${policy.returnDays === 1 ? "" : "s"} of delivery. Warranty claims any time during the warranty. Have your order number (or shop receipt) and phone ready.`}
      />
      <div className="container-x mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <AfterSalesForms initial={type === "warranty" ? "warranty" : "return"} reasons={policy.reasons.map((r) => r.label)} requirePhotos={policy.requirePhotos} returnDays={policy.returnDays} />
        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Return rules</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {policy.returnRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {policy.restockingFeePercent > 0 && <li>Change-of-mind returns have a {policy.restockingFeePercent}% restocking fee.</li>}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Warranty rules</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {policy.warrantyRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Link href="/warranty-returns" className="mt-3 inline-block text-sm font-semibold text-violet-300 hover:underline">
              Full warranty & returns policy →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
