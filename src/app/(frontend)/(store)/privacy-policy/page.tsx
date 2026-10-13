import type { Metadata } from "next";
import { PolicyLayout } from "@/components/content/policy-layout";
import { InlineText } from "@/components/content/inline-text";
import { Markdown } from "@/components/ui/markdown";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";

/* Content & SEO are editable in /cms → Online store → Page texts (defaults: src/lib/content/page-defaults.ts). */

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/privacy-policy");
}

export default async function PrivacyPolicyPage() {
  const c = await getResolvedPageContent("/privacy-policy");
  return (
    <PolicyLayout path="/privacy-policy" name="Privacy Policy" eyebrow={c.eyebrow || undefined} title={<InlineText text={c.title} />} description={c.description} updated={c.updated}>
      <Markdown content={c.body} className="card p-6 sm:p-10" />
    </PolicyLayout>
  );
}
