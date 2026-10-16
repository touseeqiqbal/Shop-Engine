import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CircleHelp, LogIn, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/sections";
import { SITE } from "@/lib/marketing/content";
import { breadcrumbLd, ldJson, marketingOrigin, pageMeta } from "@/lib/marketing/seo";

const CRUMBS = [{ name: "Contact", path: "/contact" }];

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Contact",
    description: "Talk to the ShopEngine team about plans, getting started, agencies and partnerships, or support for your store.",
    path: "/contact",
  });
}

const ASIDE = [
  { icon: LogIn, title: "Already have a store?", text: "Sign in to see your stores, plans and invitations.", href: SITE.signIn, link: "Sign in" },
  { icon: CircleHelp, title: "Quick answers", text: "Stores, payments, plans and trials explained.", href: "/faq", link: "Read the FAQ" },
  { icon: BookOpen, title: "Getting started", text: "What happens from sign-up to the first order.", href: "/how-it-works", link: "How it works" },
  { icon: ShieldCheck, title: "Security issue?", text: "Choose “Security report” as the topic and tell us what you found.", href: "/security", link: "Our security approach" },
];

export default async function ContactPage() {
  const origin = await marketingOrigin();
  return (
    <>
      <PageHero crumbs={CRUMBS} eyebrow="Contact" title="Talk to the ShopEngine team" lead="Questions about plans, setting up your stores or working with us as an agency? Send a message and we'll reply by email." />
      <section className="relative pb-24 pt-2">
        <div className="mk-container grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="mk-card relative p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Send us a message</h2>
            <p className="mt-1.5 text-sm text-body">All fields are required unless marked optional.</p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
          <aside aria-label="Other ways to get help" className="space-y-4">
            {ASIDE.map((a) => (
              <div key={a.title} className="mk-card mk-spot flex gap-4 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.1] to-white/[0.02] text-brand-200">
                  <a.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{a.title}</h3>
                  <p className="mt-1 text-sm text-body">{a.text}</p>
                  <Link href={a.href} className="mk-link mt-2 inline-block text-sm">
                    {a.link}
                  </Link>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(origin, CRUMBS)) }} />
    </>
  );
}
