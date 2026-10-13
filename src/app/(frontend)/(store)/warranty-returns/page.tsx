import type { Metadata } from "next";
import { BadgeCheck, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { PolicyLayout } from "@/components/content/policy-layout";
import { Markdown } from "@/components/ui/markdown";
import { InlineText } from "@/components/content/inline-text";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { getReturnsPolicy } from "@/lib/cms/aftersales";
import Link from "next/link";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/warranty-returns");
}


// Policy text: /cms → Online store → Page texts. Rules, reasons and the warranty table: /cms → Settings → Returns & warranty rules.

export default async function WarrantyReturnsPage() {
  const [c, policy] = await Promise.all([getResolvedPageContent("/warranty-returns"), getReturnsPolicy()]);
  return (
    <PolicyLayout path="/warranty-returns" name="Warranty & Returns" eyebrow={c.eyebrow || undefined} title={<InlineText text={c.title} />} description={c.description} updated={c.updated}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ShieldCheck, t: "Warranty on everything", d: "New, refurbished & used" },
          { icon: RotateCcw, t: `${policy.returnDays}-day returns`, d: "Wrong, damaged or faulty items" },
          { icon: BadgeCheck, t: "Checked & tested", d: "30+ point inspection" },
          { icon: Clock3, t: "Fast claims", d: "Most resolved in 3–7 days" },
        ].map((b) => (
          <li key={b.t} className="card flex items-center gap-3 p-4">
            <b.icon className="size-6 shrink-0 text-violet-400" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-fg">{b.t}</span>
              <span className="block text-xs text-muted">{b.d}</span>
            </span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="warranty-table-heading">
        <h2 id="warranty-table-heading" className="mb-4 text-2xl font-bold text-fg">
          Warranty by product type
        </h2>
        <div className="prose-store">
          <table>
            <thead>
              <tr>
                <th scope="col">Condition / product</th>
                <th scope="col">Warranty</th>
                <th scope="col">Claimed at</th>
              </tr>
            </thead>
            <tbody>
              {policy.warrantyTable.map((r) => (
                <tr key={r.type}>
                  <td className="font-semibold text-fg">{r.type}</td>
                  <td>{r.text}</td>
                  <td>{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">The exact warranty for each item is always shown on its product page and on your invoice.</p>
      </section>

      <section aria-labelledby="rules-heading" className="grid gap-4 md:grid-cols-2">
        <h2 id="rules-heading" className="sr-only">
          Return and warranty rules
        </h2>
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold text-fg">Returns</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
            <li>Ask within {policy.returnDays} day{policy.returnDays === 1 ? "" : "s"} of delivery.</li>
            {policy.returnRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {policy.restockingFeePercent > 0 && <li>Change-of-mind returns have a {policy.restockingFeePercent}% restocking fee.</li>}
          </ul>
          <Link href="/returns" className="btn btn-primary mt-4">
            Start a return
          </Link>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-lg font-bold text-fg">Warranty claims</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
            {policy.warrantyRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Link href="/returns?type=warranty" className="btn btn-secondary mt-4">
            Claim warranty
          </Link>
        </div>
      </section>

      <Markdown content={c.body} className="card p-6 sm:p-10" />
    </PolicyLayout>
  );
}
