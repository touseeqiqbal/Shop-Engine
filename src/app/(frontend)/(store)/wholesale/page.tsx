import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck, Boxes, Building2, ClipboardCheck, FileText, Handshake, Layers, Laptop, MessageSquareText, PackageCheck, PlugZap,
  ShieldCheck, Truck, Wallet,
} from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { FaqAccordion } from "@/components/content/faq-accordion";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { JsonLd } from "@/components/ui/json-ld";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { WholesaleQuoteForm, type QuoteItemDraft } from "@/components/wholesale/quote-form";
import { getAllProducts, getProductBySlug } from "@/lib/repo/catalog";
import { STORE_ID, faqJsonLd, itemListJsonLd } from "@/lib/seo";
import { getPageMeta } from "@/lib/page-seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { absoluteUrl, waLink } from "@/lib/site";
import { primaryPhone, storePlace, type SiteInfo } from "@/lib/site-info";
import { getCurrentStore } from "@/lib/tenant";
import type { FaqItem } from "@/lib/types";
import { WHOLESALE_CATEGORY_SLUG, WHOLESALE_PATH, isWholesaleAvailable, wholesaleMinQty } from "@/lib/wholesale";
import { getStoreLocale } from "@/lib/store-locale";
import { countryInText, deliveryArea } from "@/lib/locale";

// Title/description/share image can be overridden in /cms → Online store → Page texts.
export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStore();
  // these texts describe the original shop; any other store gets the plain built-in ones with its own name
  if (store && !store.isDefault) return getPageMeta(WHOLESALE_PATH);
  const { name } = await getSiteInfo();
  return getPageMeta(WHOLESALE_PATH, {
    title: `Wholesale Used Laptops in Pakistan – Bulk Laptops Karachi | ${name}`,
    description:
      "Wholesale used laptops & accessories from Saddar, Karachi: bulk HP, Dell & Lenovo laptops, mixed laptop lots and chargers/batteries in bulk for shops, resellers & offices. Checked & tested, delivery all over Pakistan. Request a quote.",
  });
}

const SUPPLY = [
  {
    icon: Laptop,
    title: "Bulk quantities of one model",
    text: "10, 20 or 50 identical laptops – e.g. 20× HP EliteBook 840 G5 Core i5 8th Gen – with matching specs for offices, labs and call centres.",
    tone: "from-sky-500/20 to-blue-500/5 text-sky-400",
  },
  {
    icon: Boxes,
    title: "Mixed lots & pallets",
    text: "Value lots like “25 mixed Dell & HP Core i5 8th Gen, Grade A/B” for computer shops and online resellers. Exact model list shared with the quote.",
    tone: "from-violet-500/20 to-fuchsia-500/5 text-violet-400",
  },
  {
    icon: PlugZap,
    title: "Accessories in bulk",
    text: "Chargers, batteries, mouse, keyboards, SSDs and RAM by the box for repair shops and resellers – brand-wise or mixed to your needs.",
    tone: "from-emerald-500/20 to-teal-500/5 text-emerald-400",
  },
];

// texts that name the shop's area / city / address come from the store's own profile (Settings → Store details)
const shopAddress = (site: SiteInfo) => [site.address.street.split(",")[0], site.address.area, site.address.city].filter(Boolean).join(", ");

const why = (site: SiteInfo) => [
  { icon: ClipboardCheck, title: "Checked & tested", text: `Every unit is tested on 30+ points – battery, display, keyboard, ports, Wi-Fi and thermals – in our ${site.address.area ? `${site.address.area} ` : ""}workshop.` },
  { icon: Layers, title: "Honest A / B grading", text: "Grade A: light signs of use only. Grade B: visible scratches or wear but 100% working. The grade is written on every lot." },
  { icon: ShieldCheck, title: "Warranty on bulk", text: "Checking warranty on every unit in the lot – faulty pieces are repaired or replaced, no arguments." },
  { icon: Truck, title: "Nationwide delivery", text: "Courier for smaller orders and cargo for pallets – Lahore, Islamabad, Peshawar, Multan, Quetta and every other city." },
  { icon: FileText, title: "Proper invoice", text: "Itemised invoice with serial numbers for every bulk order – ready for your accounts and resale." },
  { icon: Wallet, title: "Flexible payment terms", text: "Advance or part-advance with balance on delivery for repeat buyers. Terms are agreed with each quote." },
];

const steps = (site: SiteInfo) => [
  { icon: MessageSquareText, title: "Send your requirement", text: "Tell us the models, quantity, grade and city using the quote form or WhatsApp." },
  { icon: Handshake, title: "Get a quote", text: "We reply with per-unit prices, photos and videos of the actual stock – usually within store hours." },
  { icon: BadgeCheck, title: "Confirm & inspect", text: `Confirm the order with an advance. Visit our ${site.address.area ? `${site.address.area} ` : ""}shop to inspect, or get a video walkthrough.` },
  { icon: PackageCheck, title: "Packed & delivered", text: "Units are packed securely and shipped by courier or cargo with an invoice and warranty." },
];

const faqs = (site: SiteInfo, country: string): FaqItem[] => [
  {
    q: "Why don't you publish wholesale prices?",
    a: "Wholesale prices depend on the quantity, grade, specs and the current dollar rate, which changes almost daily. To give you the best real price we quote every bulk order individually – just send the quote form or WhatsApp us.",
  },
  {
    q: "What is the minimum order for wholesale?",
    a: "Most bulk prices start from 5 units of the same model. Lots and pallets are sold as listed (for example 20 or 25 laptops). For accessories like chargers and batteries the minimum is usually 10 pieces.",
  },
  {
    q: "What do Grade A and Grade B mean?",
    a: "Grade A laptops have only light signs of use and look close to new. Grade B laptops have visible scratches, worn keys or palm-rest marks but are fully working. Both grades are checked and tested before dispatch.",
  },
  {
    q: "Do bulk laptops come with warranty?",
    a: "Yes. Every unit in a wholesale order gets a checking warranty (typically 15 days for used laptops). If a unit is faulty we repair or replace it.",
  },
  {
    q: `Do you deliver wholesale orders ${site.address.city ? `outside ${site.address.city}` : "to other cities"}?`,
    a: `Yes, we deliver ${deliveryArea(country)}. Smaller bulk orders go by courier (${country === "PK" ? "TCS, Leopards, M&P and others" : "our usual couriers"}) and larger lots or pallets by cargo. Delivery charges are included in your quote.`,
  },
  {
    q: "Can I inspect the laptops before paying the full amount?",
    a: `Yes. You can visit our shop${shopAddress(site) ? ` at ${shopAddress(site)}` : ""} to inspect the stock, or we send photos and a video walkthrough of the exact units before dispatch.`,
  },
  {
    q: "Can you upgrade RAM or SSD for the whole lot?",
    a: "Yes – RAM and SSD upgrades, fresh Windows installation and battery replacements can be done for the whole order. Mention it in your quote request.",
  },
];

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Resolves ?product=<slug>&qty=<n> into a pre-filled quote row. */
async function prefill(sp: Awaited<SP>): Promise<QuoteItemDraft[]> {
  const slug = one(sp.product).slice(0, 160);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return [];
  const p = await getProductBySlug(slug);
  if (!p) return [];
  const asked = Math.floor(Number(one(sp.qty)));
  const qty = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 100_000) : p.priceOnRequest ? 1 : Math.max(wholesaleMinQty(p), 10);
  return [{ productId: p.id, productName: p.name, qty }];
}

function serviceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(WHOLESALE_PATH)}#service`,
    name: "Wholesale used laptops & accessories",
    serviceType: "Wholesale laptop and computer accessories supply",
    description:
      "Bulk used and refurbished laptops (single-model lots and mixed pallets) and laptop accessories in bulk for shops, resellers, offices and institutes. Price on request.",
    url: absoluteUrl(WHOLESALE_PATH),
    provider: { "@id": STORE_ID },
    areaServed: { "@type": "Country", name: "Pakistan" },
    audience: { "@type": "BusinessAudience", audienceType: "Computer shops, resellers, companies and educational institutes" },
  };
}

export default async function WholesalePage({ searchParams }: { searchParams: SP }) {
  const [sp, all, site, { country }] = await Promise.all([searchParams, getAllProducts(), getSiteInfo(), getStoreLocale()]);
  const initialItems = await prefill(sp);

  const lots = all.filter((p) => p.topCategorySlug === WHOLESALE_CATEGORY_SLUG || p.priceOnRequest);
  const bulkRetail = all.filter((p) => !lots.includes(p) && isWholesaleAvailable(p)).sort((a, b) => b.soldCount - a.soldCount);
  const listed = [...lots.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...bulkRetail].slice(0, 12);
  const waText = `Hi ${site.name}! I'd like a wholesale quote for bulk laptops / accessories.`;
  const phone = primaryPhone(site);
  const place = storePlace(site);
  const FAQS = faqs(site, country);

  return (
    <div className="pb-16">
      <JsonLd data={serviceJsonLd()} />
      <JsonLd data={faqJsonLd(FAQS)} />
      {listed.length > 0 && <JsonLd data={itemListJsonLd(listed, "Wholesale laptop lots & bulk products")} />}

      <PageHero
        crumbs={[{ name: "Wholesale", href: WHOLESALE_PATH }]}
        eyebrow={`Wholesale & bulk orders${place ? ` · ${place}` : ""}`}
        title={
          <>
            Wholesale <span className="gradient-text">Laptops &amp; Accessories</span> in {countryInText(country)}
          </>
        }
        description={
          <>
            Bulk used laptops, mixed laptop lots and accessories by the box for computer shops, resellers, offices and institutes. Checked &amp; tested
            {place ? ` in ${place}` : ""} and delivered {deliveryArea(country)} – <strong className="text-fg">price on request</strong>.
          </>
        }
        glow="from-cyan-500/25 via-blue-500/20 to-violet-500/15"
      >
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="#quote" className="btn btn-primary btn-lg">
            <FileText className="size-5" aria-hidden="true" /> Request a wholesale quote
          </a>
          {phone.wa && (
            <a href={waLink(phone.wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
              <WhatsAppIcon className="size-5" /> WhatsApp {phone.display}
            </a>
          )}
        </div>
        <ul className="mt-7 flex flex-wrap gap-2 text-sm">
          {["5+ units per model", "Grade A / B lots", "Invoice & warranty", "Courier & cargo nationwide"].map((t) => (
            <li key={t} className="chip">
              <BadgeCheck className="size-3.5 text-emerald-400" aria-hidden="true" /> {t}
            </li>
          ))}
        </ul>
      </PageHero>

      <div className="container-x mt-12 space-y-16 sm:mt-16 sm:space-y-24">
        {/* What we supply */}
        <section aria-labelledby="supply-heading">
          <SectionHeading
            eyebrow="What we supply"
            title={<span id="supply-heading">Bulk laptops, lots &amp; accessories</span>}
            description={`Three ways to buy wholesale from ${site.name} – all quote-based, all checked before dispatch.`}
          />
          <ul className="grid gap-4 md:grid-cols-3">
            {SUPPLY.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="glow-hover card relative overflow-hidden p-6 sm:p-7">
                <div className={`pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gradient-to-br blur-3xl ${s.tone.split(" ").slice(0, 2).join(" ")}`} aria-hidden="true" />
                <span className={`relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${s.tone}`}>
                  <s.icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 text-lg font-bold text-fg">{s.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Current lots */}
        {listed.length > 0 && (
          <section aria-labelledby="lots-heading">
            <SectionHeading
              eyebrow="Available now"
              title={<span id="lots-heading">Current wholesale lots &amp; bulk products</span>}
              description="Lots are sold by quote only. Products marked with a price can be bought singly online or in bulk at a wholesale rate."
              href={`/category/${WHOLESALE_CATEGORY_SLUG}`}
              hrefLabel="All wholesale lots"
            />
            <ProductGrid products={listed} />
          </section>
        )}

        {/* Why buy from us */}
        <section aria-labelledby="why-heading" className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-sky-500/10 via-blue-600/5 to-violet-600/10 p-6 sm:p-10">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative">
            <SectionHeading
              eyebrow={`Why buy from ${site.shortName}`}
              title={<span id="why-heading">Trusted wholesale partner{site.address.area ? ` in ${site.address.area}'s laptop market` : ""}</span>}
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {why(site).map((w) => (
                <li key={w.title} className="glass rounded-3xl p-5">
                  <w.icon className="size-6 text-sky-400" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-fg">{w.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{w.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading">
          <SectionHeading eyebrow="How it works" title={<span id="how-heading">From quote to delivery in 4 steps</span>} />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps(site).map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="card relative p-6">
                <span className="absolute right-5 top-4 font-display text-4xl font-bold text-fg/10" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-gradient text-white">
                  <s.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Quote form */}
        <section id="quote" aria-labelledby="quote-heading" className="scroll-mt-28">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="card p-6 sm:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] gradient-text">Get prices</p>
              <h2 id="quote-heading" className="text-2xl font-bold text-fg sm:text-3xl">
                Request a wholesale quote
              </h2>
              <p className="mb-6 mt-1.5 text-sm text-muted">Tell us what you need – we&apos;ll reply with prices, photos and availability.</p>
              <WholesaleQuoteForm key={initialItems.map((i) => `${i.productId}:${i.qty}`).join(",") || "empty"} initialItems={initialItems} source={WHOLESALE_PATH} />
            </div>
            <aside className="space-y-4" aria-label="Wholesale contact">
              <div className="glass rounded-3xl p-6">
                <Building2 className="size-6 text-violet-400" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-fg">Prefer to talk?</h3>
                <p className="mt-1 text-sm text-muted">WhatsApp is the fastest way to get photos and videos of the current stock.</p>
                <div className="mt-4 space-y-2">
                  {site.phones.map((p) => (
                    <a key={p.tel} href={waLink(p.wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
                      <WhatsAppIcon className="size-4" /> {p.display}
                    </a>
                  ))}
                </div>
              </div>
              <div className="card p-6 text-sm text-muted">
                <h3 className="font-semibold text-fg">Visit our shop</h3>
                <p className="mt-1">{site.address.full}</p>
                <p className="mt-1">{site.hoursDisplay}</p>
                <Link href="/contact" className="mt-3 inline-block font-semibold text-fg underline underline-offset-4">
                  Directions &amp; contact
                </Link>
              </div>
            </aside>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title={<span id="faq-heading">Wholesale questions</span>} />
          <FaqAccordion items={FAQS} />
        </section>
      </div>
    </div>
  );
}
