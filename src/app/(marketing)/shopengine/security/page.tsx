import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { CtaBand, PageHero, SecurityGrid, SecurityVisual } from "@/components/marketing/sections";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "Security", path: "/security" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Security",
    description: "How ShopEngine keeps every store separate and secure: store-level data isolation, role-based access, two-step verification, server-verified payments and reliable notifications.",
    path: "/security",
  });
}

const DETAILS = [
  {
    title: "Accounts and sign-in",
    points: [
      "Passwords are stored as one-way hashes, never in readable form",
      "Sign-in attempts are rate-limited per network and per account",
      "Owners and managers use two-step verification with an authenticator app",
      "Bot protection on sign-up and public forms where it's switched on",
    ],
  },
  {
    title: "Stores and teams",
    points: [
      "Every record carries the store it belongs to, and the server filters by it",
      "Roles are given per store – access to one store says nothing about another",
      "Nobody can give a role above their own; the owner is changed only by ShopEngine support",
      "Important changes are kept in an activity log",
    ],
  },
  {
    title: "Payments and orders",
    points: [
      "Card payments are confirmed by the provider's signed message, not the browser",
      "Card details are entered on the payment provider's page – ShopEngine never sees them",
      "A transaction id for a bank or wallet payment can only be used once in a store",
      "An order, its stock and its discount use are saved together",
    ],
  },
  {
    title: "Running the platform",
    points: [
      "Data is sent over HTTPS",
      "Emails, messages and webhooks are queued and retried with back-off",
      "Webhooks to your own systems are signed so you can verify them",
      "Built-in error reporting for the ShopEngine team",
    ],
  },
];

export default async function SecurityPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="Security & reliability" title="Built to keep every store separate and secure" lead="Many businesses run on ShopEngine at the same time, so isolation and access control are part of the core – not an add-on." />

      <section className="pb-24" aria-labelledby="principles">
        <div className="mk-container">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="mk-reveal">
              <p className="mk-eyebrow">The principles</p>
              <h2 id="principles" className="mk-h2 mt-5">
                Isolation first.
                <br />
                <span className="mk-gradient-text">Checks everywhere.</span>
              </h2>
              <p className="mk-lead mt-6">Six rules the engine follows on every request, for every store.</p>
            </div>
            <div className="mk-reveal">
              <SecurityVisual />
            </div>
          </div>
          <SecurityGrid />
        </div>
      </section>

      <section className="mk-section" aria-labelledby="details">
        <div className="mk-container">
          <h2 id="details" className="mk-h2 text-[clamp(1.9rem,3.4vw,2.75rem)]">
            In detail
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {DETAILS.map((d) => (
              <article key={d.title} className="mk-card p-6 sm:p-7">
                <h3 className="mk-h3">{d.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {d.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[0.9375rem] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-200" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm leading-relaxed text-body">
            ShopEngine doesn’t currently hold third-party security certifications. Found a security issue? Please tell us through the{" "}
            <Link href="/contact" className="mk-link">
              contact page
            </Link>{" "}
            and we’ll get back to you.
          </p>
        </div>
      </section>

      <CtaBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
