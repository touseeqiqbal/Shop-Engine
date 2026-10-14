import type { Metadata } from "next";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { ContactForm } from "@/components/content/contact-form";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { waLink } from "@/lib/site";
import { getPageMeta } from "@/lib/page-seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import { storePlace } from "@/lib/site-info";
import { getCurrentStore } from "@/lib/tenant";

/** The original (default) store – or demo mode, which is that store. The hand-written texts below are about its Saddar shop. */
async function isOriginalStore() {
  const store = await getCurrentStore();
  return !store || store.isDefault;
}

export async function generateMetadata(): Promise<Metadata> {
  const [site, original] = await Promise.all([getSiteInfo(), isOriginalStore()]);
  // any other store: the plain built-in title / description with its own name
  if (!original) return getPageMeta("/contact");
  // Default description follows the live phone numbers / email from Store info.
  return getPageMeta("/contact", {
    title: `Contact ${site.name} – Laptop Shop in Saddar, Karachi | WhatsApp & Phone`,
    description: `Contact ${site.name} at ${site.address.full.replace(/, Pakistan$/, "")}. Call or WhatsApp ${site.phones.map((p) => p.display).join(" / ")}, email ${site.email}. Delivery all over Pakistan.`,
  });
}

export default async function ContactPage() {
  const [site, original] = await Promise.all([getSiteInfo(), isOriginalStore()]); // live business profile (/cms → Settings → Store details)
  const place = storePlace(site);
  return (
    <div className="pb-16">
      <PageHero
        crumbs={[{ name: "Contact", href: "/contact" }]}
        eyebrow="We're here to help"
        title={
          original ? (
            <>
              Contact our <span className="gradient-text">laptop shop in Karachi</span>
            </>
          ) : (
            <>
              Contact <span className="gradient-text">{site.name}</span>
            </>
          )
        }
        description={
          original
            ? "Questions about a laptop, a charger that fits, or an order on its way? Call, WhatsApp, email or visit us in the Regal Chowk laptop market, Saddar."
            : "Questions about a product or an order on its way? Call, WhatsApp or email us – we're happy to help."
        }
      />

      <div className="container-x mt-8 space-y-10 sm:mt-12 sm:space-y-14">
        {/* Phone / WhatsApp cards */}
        <section aria-labelledby="reach-heading">
          <h2 id="reach-heading" className="sr-only">
            Phone and WhatsApp
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {site.phones.map((p, i) => (
              <li key={p.tel} className="glow-hover card relative overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-14 -top-14 size-48 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  {p.label} · Phone & WhatsApp
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-fg sm:text-3xl">{p.display}</p>
                <div className="relative mt-5 flex flex-wrap gap-2">
                  <a href={`tel:${p.tel}`} className="btn btn-secondary" aria-label={`Call ${p.display}`}>
                    <Phone className="size-4" aria-hidden="true" /> Call now
                  </a>
                  <a
                    href={waLink(p.wa, `Hi ${site.name}! I have a question.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-whatsapp"
                    aria-label={`WhatsApp ${p.display}`}
                  >
                    <WhatsAppIcon className="size-4" /> WhatsApp
                  </a>
                </div>
                {i === 0 && <p className="relative mt-4 text-xs text-subtle">Fastest replies on WhatsApp – send photos of your old charger or battery label.</p>}
                {i === 1 && <p className="relative mt-4 text-xs text-subtle">Orders, delivery tracking and after-sales support.</p>}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <section aria-labelledby="form-heading" className="card p-6 sm:p-8">
            <h2 id="form-heading" className="text-2xl font-bold text-fg">
              Send us a message
            </h2>
            <p className="mb-6 mt-1 text-sm text-muted">Fill in the form and our team will get back to you by phone, WhatsApp or email.</p>
            <ContactForm />
          </section>

          {/* Details */}
          <section aria-labelledby="details-heading" className="card flex flex-col gap-6 p-6 sm:p-8">
            <h2 id="details-heading" className="text-2xl font-bold text-fg">
              Store details
            </h2>
            <address className="space-y-5 not-italic">
              <div className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
                  <MapPin className="size-5 text-violet-400" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{site.name}</p>
                  <p className="text-sm text-muted">{site.address.full}</p>
                  <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300">
                    <Navigation className="size-3.5" aria-hidden="true" /> Get directions
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
                  <Mail className="size-5 text-sky-400" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">Email</p>
                  <a href={`mailto:${site.email}`} className="text-sm text-muted hover:text-fg">
                    {site.email}
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
                  <Phone className="size-5 text-emerald-400" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">Phone & WhatsApp</p>
                  {site.phones.map((p) => (
                    <a key={p.tel} href={`tel:${p.tel}`} className="block text-sm text-muted hover:text-fg">
                      {p.display}
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-strong">
                  <Clock className="size-5 text-amber-400" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">Store hours</p>
                  <p className="text-sm text-muted">{site.hoursDisplay}</p>
                </div>
              </div>
            </address>
            <div className="mt-auto rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              <strong className="text-fg">Delivery all over Pakistan.</strong>{" "}
              {original ? "Karachi same / next day, major cities 1–3 working days, other areas 3–5 working days – with Cash on Delivery." : "With Cash on Delivery."}
            </div>
          </section>
        </div>

        {/* Map (from Store details – none until the store adds one) */}
        {site.mapEmbed && (
        <section aria-labelledby="map-heading">
          <h2 id="map-heading" className="mb-4 text-2xl font-bold text-fg">
            {original ? "Find us in Saddar, Karachi" : place ? `Find us in ${place}` : "Find us"}
          </h2>
          <div className="relative h-[22rem] overflow-hidden rounded-[1.75rem] border border-border sm:h-[28rem]">
            <iframe
              title={`${site.name} on Google Maps – ${site.address.full}`}
              src={site.mapEmbed}
              className="absolute inset-0 size-full border-0 grayscale-[30%] invert-[0.9] hue-rotate-180 light:invert-0 light:hue-rotate-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          {original && (
            <p className="mt-3 text-sm text-muted">
              We&apos;re inside Regal Trade Square at Regal Chowk – the heart of Karachi&apos;s laptop market, close to Empress Market and Zaibunnisa Street.
            </p>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
