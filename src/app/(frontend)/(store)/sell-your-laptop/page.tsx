import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { TradeInForm } from "@/components/aftersales/trade-in-form";
import { getPageMeta } from "@/lib/page-seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  // title & description editable in /cms → Settings → Google & SEO → Built-in pages
  return getPageMeta("/sell-your-laptop");
}

export default function SellYourLaptopPage() {
  return (
    <div className="pb-16">
      <PageHero
        crumbs={[{ name: "Sell your laptop", href: "/sell-your-laptop" }]}
        eyebrow="Sell / trade in"
        title={
          <>
            Sell your laptop or <span className="gradient-text">trade it in</span>
          </>
        }
        description="Tell us about your laptop and add a few photos. We'll send you a fair cash offer – or a trade-in value off your next laptop – usually the same day."
      />
      <div className="container-x mt-8 max-w-3xl">
        <TradeInForm />
      </div>
    </div>
  );
}
