import type { Metadata } from "next";
import { GitCompareArrows } from "lucide-react";
import { getPageMeta } from "@/lib/page-seo";
import { PageHero } from "@/components/shop/page-hero";
import { CompareView } from "@/components/shop/compare-view";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/compare");
}

export default function ComparePage() {
  return (
    <div className="container-x pb-16">
      <PageHero
        crumbs={[{ name: "Compare", href: "/compare" }]}
        eyebrow="Side by side"
        title={
          <>
            Compare <span className="gradient-text">products</span>
          </>
        }
        description={<p>Specs, prices, condition and warranty – compare up to 3 products to find the right one.</p>}
        icon={<GitCompareArrows className="size-7" aria-hidden="true" />}
      />
      <CompareView />
    </div>
  );
}
