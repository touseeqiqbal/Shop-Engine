import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, HeroBackdrop } from "@/components/marketing/sections";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

// NOTE: plain-language starting text written from what the platform does – have it reviewed for your jurisdiction before launch.

const CRUMBS = [{ name: "Privacy policy", path: "/privacy" }];
const UPDATED = "2026-10-16";

export function generateMetadata(): Metadata {
  return pageMeta({ title: "Privacy policy", description: "How ShopEngine collects, uses and protects personal data of merchants, their teams and visitors to this website.", path: "/privacy" });
}

export default async function PrivacyPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <div className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <HeroBackdrop />
        <div className="mk-container relative max-w-3xl pb-14 pt-32 sm:pt-40">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="mk-h1 mt-8 text-[clamp(2.2rem,4.6vw,3.6rem)]">Privacy policy</h1>
          <p className="mt-3 text-sm text-faint">
            Last updated <time dateTime={UPDATED}>16 October 2026</time>
          </p>
        </div>
      </div>
      <div className="mk-container max-w-3xl py-12 sm:py-16">
        <div className="mk-prose">
          <p>This policy explains what personal data ShopEngine handles when you visit this website, create a ShopEngine account or run a store on the platform, and how we protect it.</p>

          <h2>Who this covers</h2>
          <ul>
            <li>
              <strong>Visitors</strong> to the ShopEngine website.
            </li>
            <li>
              <strong>Merchants and their teams</strong> – people with a ShopEngine account who own or work in a store.
            </li>
            <li>
              <strong>Shoppers</strong> of stores that run on ShopEngine. For shopper data, the store is responsible for how it is used; ShopEngine stores and processes it on the store’s behalf to run the store. Each store publishes its own privacy policy.
            </li>
          </ul>

          <h2>What we collect</h2>
          <ul>
            <li>Account details: your name, email address, a one-way hash of your password and, if you turn it on, your two-step verification setup.</li>
            <li>Store details you enter: store name, web address, country, business details, products, settings and team invitations.</li>
            <li>Billing details: your plan and its payment status. Card payments are handled by the payment provider; ShopEngine doesn’t receive or store card numbers.</li>
            <li>Messages you send us through the contact form: your name, email address, company and message.</li>
            <li>Technical data needed to run and protect the service, such as your IP address (used for rate limits and abuse prevention) and error reports.</li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To provide the platform: sign-in, running your stores, sending the emails and messages you set up, and billing your plan.</li>
            <li>To keep the service secure: preventing abuse, limiting repeated sign-in attempts and investigating problems.</li>
            <li>To reply to your messages and tell you about important changes to your account or the service.</li>
          </ul>
          <p>We don’t sell personal data.</p>

          <h2>Cookies</h2>
          <p>
            This website and the account pages use cookies that are needed to work – for example to keep you signed in. If a security check is shown on a form, it is provided by Cloudflare Turnstile. Stores can add their own analytics to their storefronts; their privacy policies describe it.
          </p>

          <h2>Service providers</h2>
          <p>We use providers to host the platform, send email and messages, take payments and report errors. They receive only what they need to do that work for us.</p>

          <h2>How long we keep it</h2>
          <p>We keep account and store data while the account or store exists. When a store’s plan lapses, its data is kept (the store is paused, not deleted) so it can be reopened. Contact messages are kept for as long as needed to deal with them.</p>

          <h2>Your choices</h2>
          <p>
            You can change your password at any time. To ask for a copy of your data, a correction or deletion, write to us through the <Link href="/contact">contact page</Link>. Shoppers should contact the store they bought from.
          </p>

          <h2>Changes</h2>
          <p>If this policy changes, we’ll update the date above and, for important changes, tell account holders by email.</p>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
