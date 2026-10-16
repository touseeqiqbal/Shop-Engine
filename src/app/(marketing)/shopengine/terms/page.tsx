import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, HeroBackdrop } from "@/components/marketing/sections";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

// NOTE: plain-language starting text written from how the platform works – have it reviewed for your jurisdiction before launch.

const CRUMBS = [{ name: "Terms of service", path: "/terms" }];
const UPDATED = "2026-10-16";

export function generateMetadata(): Metadata {
  return pageMeta({ title: "Terms of service", description: "The terms for using ShopEngine: accounts, stores, plans and billing, acceptable use and responsibilities.", path: "/terms" });
}

export default async function TermsPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <div className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <HeroBackdrop />
        <div className="mk-container relative max-w-3xl pb-14 pt-32 sm:pt-40">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="mk-h1 mt-8 text-[clamp(2.2rem,4.6vw,3.6rem)]">Terms of service</h1>
          <p className="mt-3 text-sm text-faint">
            Last updated <time dateTime={UPDATED}>16 October 2026</time>
          </p>
        </div>
      </div>
      <div className="mk-container max-w-3xl py-12 sm:py-16">
        <div className="mk-prose">
          <p>These terms apply when you create a ShopEngine account or run a store on ShopEngine. By creating an account you agree to them.</p>

          <h2>Your account</h2>
          <ul>
            <li>Give accurate details and keep your password and two-step verification safe. You’re responsible for what happens under your account.</li>
            <li>Confirm your email address before opening a store.</li>
            <li>Invite only people you trust to your stores, with the role they need.</li>
          </ul>

          <h2>Stores</h2>
          <ul>
            <li>Each store has one owner, who is responsible for the store, its plan and its payment accounts. A change of owner is made by ShopEngine support.</li>
            <li>The store is responsible for its products, prices, descriptions, delivery and returns, the payment methods it offers, and its own terms and privacy policy for shoppers.</li>
            <li>An account can own a limited number of stores (three by default); ShopEngine may raise the limit on request.</li>
          </ul>

          <h2>Plans and billing</h2>
          <ul>
            <li>Each store is on its own plan. Plan prices, limits and features are shown on the <Link href="/pricing">pricing page</Link> and when you choose a plan.</li>
            <li>Plans with a free trial start with the trial. To keep the store running after the trial, the plan must be paid.</li>
            <li>If a payment fails, the store gets a grace period (seven days by default). After that the store goes offline and its admin becomes read-only until the plan is paid. Data isn’t deleted because of a missed payment.</li>
            <li>A cancelled plan runs to the end of the period already paid.</li>
          </ul>

          <h2>Payments to stores</h2>
          <p>Money from shoppers goes to the store – directly (cash on delivery, bank transfer, local wallets) or through the store’s own account with a payment provider. ShopEngine isn’t a party to the sale between a store and its shoppers.</p>

          <h2>Acceptable use</h2>
          <p>Don’t use ShopEngine to sell illegal goods or services, to mislead or defraud people, to send spam, or to try to access other stores’ data or disrupt the service. We may pause a store or account that breaks these rules.</p>

          <h2>Availability and changes</h2>
          <p>We work to keep ShopEngine available and secure, but we can’t promise it will never be interrupted. We may improve or change features; we’ll tell account holders about important changes in advance.</p>

          <h2>Ending</h2>
          <p>You can cancel a store’s plan at any time under “Your stores”. We may end or pause access for serious or repeated breaches of these terms.</p>

          <h2>Questions</h2>
          <p>
            Write to us through the <Link href="/contact">contact page</Link>.
          </p>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
