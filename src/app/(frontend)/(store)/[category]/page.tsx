import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Banknote, Clock3, MapPin, PackageCheck, PhoneCall, ShoppingCart, Truck } from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { FaqAccordion } from "@/components/content/faq-accordion";
import { WhatsAppCta } from "@/components/content/whatsapp-cta";
import { TrustBadges } from "@/components/home/sections";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { ProductCarousel } from "@/components/product/product-carousel";
import { ProductGrid } from "@/components/product/product-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { Markdown } from "@/components/ui/markdown";
import { SectionHeading } from "@/components/ui/section-heading";
import { getAllProducts, getCategoryBySlug, getStoreSettings } from "@/lib/repo/catalog";
import { LANDING_CITIES, cityFromSlug, citySlug, deliveryCharge, deliveryEstimate, deliveryZone, freeDeliveryAbove } from "@/lib/cities";
import { cityFaqs, cityInfo, cityIntro } from "@/lib/city-content";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import { faqJsonLd, itemListJsonLd } from "@/lib/seo";
import { getPageMeta } from "@/lib/page-seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { formatPKR } from "@/lib/utils";

/**
 * Single-segment storefront URLs. Handles the nationwide SEO landing pages `/laptops-in-{city}`.
 * (The segment is named `[category]` because it shares its level with `[category]/[product]`.)
 * Any other single segment that matches a category slug permanently redirects to `/category/{slug}`.
 */

export const revalidate = 300;

type Props = { params: Promise<{ category: string }> };

const PREFIX = "laptops-in-";
const cityOf = (segment: string) => (segment.startsWith(PREFIX) ? cityFromSlug(segment.slice(PREFIX.length)) : null);

export function generateStaticParams() {
  return LANDING_CITIES.map((c) => ({ category: `${PREFIX}${citySlug(c)}` }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const city = cityOf(category);
  if (!city) return {};
  const est = deliveryEstimate(city);
  const karachi = city === "Karachi";
  // /cms → Online store → Page texts → "City landing pages" can override these with a {city} template.
  return getPageMeta("/laptops-in-{city}", {
    vars: { city },
    title: karachi
      ? "Laptops in Karachi – Laptop Shop in Saddar with Same-Day Delivery | Urko Tech Store"
      : `Laptops in ${city} – Price in Pakistan with Cash on Delivery | Urko Tech Store`,
    description: karachi
      ? "Buy new, used & refurbished laptops in Karachi from our Regal Chowk, Saddar shop. Same/next-day delivery, Cash on Delivery, checked & tested with warranty."
      : `Buy new, used & refurbished laptops in ${city} online. Delivered in ${est.days} with Cash on Delivery, warranty and checked & tested quality from Urko Tech Store.`,
    path: `/${category}`,
  });
}

export default async function SingleSegmentPage({ params }: Props) {
  const { category } = await params;
  const city = cityOf(category);
  if (!city) {
    const cat = await getCategoryBySlug(category);
    if (cat) permanentRedirect(`/category/${cat.slug}`);
    notFound();
  }
  return <CityLanding city={city} />;
}

async function CityLanding({ city }: { city: string }) {
  const [all, settings, site] = await Promise.all([getAllProducts(), getStoreSettings(), getSiteInfo()]);
  const info = cityInfo(city);
  const est = deliveryEstimate(city, settings);
  const zone = deliveryZone(city);
  const karachi = zone === "karachi";
  // same rules as checkout (/cms → Delivery & payments → Delivery charges)
  const chargeRs = deliveryCharge(city, 0, settings);
  const freeAboveRs = freeDeliveryAbove(city, settings);
  const charge = chargeRs > 0 ? formatPKR(chargeRs) : "Free";
  const free = freeAboveRs > 0 ? formatPKR(freeAboveRs) : "";
  const faqs = cityFaqs(city, settings);

  const byPopular = [...all].sort((a, b) => b.soldCount - a.soldCount);
  const laptops = byPopular.filter((p) => p.topCategorySlug === "laptops").slice(0, 8);
  const accessories = byPopular.filter((p) => p.topCategorySlug !== "laptops").slice(0, 12);
  const areas = info.areas.length ? info.areas : [city];
  const others = LANDING_CITIES.filter((c) => c !== city);

  const copy = karachi
    ? `## Your laptop shop in Karachi – online and in Saddar

Urko Tech Store is a walk-in **laptop shop in Karachi** at Regal Trade Square, Regal Chowk – the city's best-known laptop market. We stock **used laptops in Karachi** graded A+ and A, refurbished business machines and brand-new laptops from HP, Dell, Lenovo, Apple, Asus and MSI.

### Same-day laptop delivery across Karachi
Order online or on WhatsApp and we deliver to ${areas.slice(0, 6).join(", ")} and every other area of Karachi – usually the same day or next day. Pay with Cash on Delivery, or collect from our shop.

### Parts, chargers & batteries while you wait
Need a **laptop battery in Karachi** or a charger that actually fits? Bring your laptop to our Saddar shop – we fit batteries, SSDs and RAM for free when you buy from us. Check the [Find Parts tool](/find-parts) for your model first.`
    : `## Buy laptops online in ${city} with confidence

Shopping for **laptops in ${city}** shouldn't mean guessing. Every laptop we send to ${city} is checked & tested on 30+ points at our Saddar, Karachi store – battery health, screen, keyboard, ports, Wi-Fi and thermals – and the exact condition is written on the product page before you order.

### Karachi laptop prices, delivered to ${city}
The Regal Chowk laptop market in Karachi is where most of Pakistan's laptops arrive first, so **laptop prices in Pakistan** are often best here. We pass those prices on and deliver to ${areas.slice(0, 5).join(", ")} and other areas of ${city}${info.province !== "Pakistan" ? ` and wider ${info.province}` : ""} in ${est.label.toLowerCase()}.

### Cash on Delivery, warranty and real support
Pay the courier when your laptop arrives. You get a checking warranty on used laptops, up to 6 months on refurbished and official warranty on new laptops – plus WhatsApp support from a real shop, not an anonymous page. Need a charger or battery too? Use our [Find Parts tool](/find-parts) to match parts to your laptop model.`;

  return (
    <div className="pb-16">
      <JsonLd data={[faqJsonLd(faqs), itemListJsonLd(laptops, `Popular laptops delivered to ${city}`)]} />
      <PageHero
        crumbs={[
          { name: "Laptops", href: "/category/laptops" },
          { name: `Laptops in ${city}`, href: `/${PREFIX}${citySlug(city)}` },
        ]}
        eyebrow={karachi ? "Saddar, Karachi · Same-day delivery" : `Delivery to ${city}, ${info.province}`}
        title={
          <>
            Laptops in {city} – <span className="gradient-text">Delivered with Cash on Delivery</span>
          </>
        }
        description={<p>{cityIntro(city, settings)}</p>}
        glow={karachi ? "from-cyan-500/25 via-blue-500/20 to-transparent" : "from-blue-500/25 via-violet-500/20 to-transparent"}
      >
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-500/15 text-sky-400">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-muted">Delivery to {city}</span>
              <span className="block font-semibold text-fg">{est.label}</span>
            </span>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Banknote className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-muted">Payment</span>
              <span className="block font-semibold text-fg">Cash on Delivery</span>
            </span>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-400">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-muted">Delivery charge</span>
              <span className="block font-semibold text-fg">
                {charge}
                {free && chargeRs > 0 ? ` · free over ${free}` : ""}
              </span>
            </span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/category/laptops" className="btn btn-primary btn-lg">
            <ShoppingCart className="size-4" aria-hidden="true" /> Shop laptops
          </Link>
          <a
            href={waLink(primaryPhone(site).wa, `Hi ${site.name}! I'm in ${city} and looking for a laptop.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp btn-lg"
          >
            <WhatsAppIcon className="size-4" /> Order on WhatsApp
          </a>
        </div>
      </PageHero>

      <div className="container-x mt-10 space-y-16 sm:mt-14 sm:space-y-20">
        <TrustBadges />

        {laptops.length > 0 && (
          <section aria-labelledby="laptops-heading">
            <SectionHeading
              eyebrow={`Popular in ${city}`}
              title={<span id="laptops-heading">Featured laptops delivered to {city}</span>}
              description="Best-selling new, used A+ and refurbished laptops – every unit checked & tested before dispatch."
              href="/category/laptops"
              hrefLabel="All laptops"
            />
            <ProductGrid products={laptops} priorityCount={2} />
          </section>
        )}

        {accessories.length > 0 && (
          <section aria-labelledby="acc-heading">
            <SectionHeading
              eyebrow="Complete your setup"
              title={<span id="acc-heading">Accessories & parts</span>}
              description={`Chargers, batteries, mouse, keyboards, SSDs and more – shipped to ${city} with your laptop.`}
              href="/shop"
              hrefLabel="Shop all"
            />
            <ProductCarousel products={accessories} label={`Accessories delivered to ${city}`} />
          </section>
        )}

        <section aria-labelledby="how-heading" className="relative overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated p-6 sm:p-10">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 id="how-heading" className="text-2xl font-bold text-fg sm:text-3xl">
              How ordering to {city} works
            </h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ShoppingCart, t: "Order online or on WhatsApp", d: "Add to cart and checkout, or send us the product link." },
                { icon: PhoneCall, t: "We confirm by call", d: "Our team confirms your order, address and delivery details." },
                { icon: PackageCheck, t: "Tested & packed", d: "Final test, bubble wrap and a sturdy box – then dispatch with tracking." },
                { icon: Banknote, t: "Pay on delivery", d: `Receive it in ${city} in ${est.days} and pay the rider in cash.` },
              ].map((s, i) => (
                <li key={s.t} className="card relative p-5">
                  <span className="absolute right-5 top-4 font-display text-3xl font-bold text-fg/10">{i + 1}</span>
                  <s.icon className="size-6 text-sky-400" aria-hidden="true" />
                  <h3 className="mt-3 font-bold text-fg">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-label={`About buying laptops in ${city}`} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="card p-6 sm:p-10">
            <Markdown content={copy} className="max-w-3xl" />
          </div>
          <div className="card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
              <MapPin className="size-5 text-violet-400" aria-hidden="true" /> Areas we deliver to
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {areas.map((a) => (
                <li key={a} className="chip text-muted">
                  {a}
                </li>
              ))}
              <li className="chip text-muted">+ all of {city}</li>
            </ul>
            <p className="mt-5 text-sm text-muted">
              Couriers: {site.couriers.join(", ")}. {karachi ? "You can also buy in person at our Saddar shop." : `Tracking number shared on WhatsApp for every ${city} order.`}
            </p>
            <Link href="/shipping-policy" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fg hover:underline">
              Shipping policy <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
          <h2 id="faq-heading" className="mb-5 text-2xl font-bold text-fg sm:text-3xl">
            Laptops in {city}: frequently asked questions
          </h2>
          <FaqAccordion items={faqs} />
        </section>

        <WhatsAppCta
          title={`Need a laptop in ${city}? Talk to us`}
          text={`Share your budget and what you'll use it for – we'll suggest the best options and deliver to ${city} with Cash on Delivery.`}
          message={`Hi Urko Tech Store! I'm in ${city} and need help choosing a laptop.`}
        />

        <nav aria-labelledby="cities-heading">
          <h2 id="cities-heading" className="mb-4 text-lg font-bold text-fg">
            We also deliver laptops to
          </h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((c) => (
              <li key={c}>
                <Link href={`/${PREFIX}${citySlug(c)}`} className="chip text-muted transition-colors hover:border-violet-500/50 hover:text-fg">
                  Laptops in {c}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
