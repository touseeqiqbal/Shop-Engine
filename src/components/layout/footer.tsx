import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./logo";
import { WhatsAppIcon } from "./whatsapp-icon";
import { waLink } from "@/lib/site";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getStoreSettings } from "@/lib/repo/catalog";
import { paymentsAcceptedText } from "@/lib/seo";
import { socialLinks } from "@/lib/site-info";
import { LANDING_CITIES, citySlug } from "@/lib/cities";
import type { Category } from "@/lib/types";
import { COMPANY_LINKS, DEFAULT_CHROME, SERVICE_LINKS, type Chrome } from "@/lib/cms/chrome-types";

function SocialIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    facebook: "M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v8h4v-8h3l1-4h-4V9c0-.6.4-1 1-1z",
    instagram:
      "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21 7.2c-.1-1.6-.4-3-1.6-4.1S16.8 1.6 15.2 1.5C13.5 1.4 10.5 1.4 8.8 1.5 7.2 1.6 5.8 1.9 4.6 3.1S3.1 5.6 3 7.2C2.9 8.9 2.9 15 3 16.8c.1 1.6.4 3 1.6 4.1s2.5 1.5 4.1 1.6c1.7.1 4.7.1 6.4 0 1.6-.1 3-.4 4.1-1.6s1.5-2.5 1.6-4.1c.1-1.7.1-7.9 0-9.6z",
    tiktok: "M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z",
    youtube:
      "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z",
  };
  paths.x = "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z";
  paths.linkedin = "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3V9.5zm7 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5z";
  paths.pinterest = "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.5 2.1-4.5 4.4 0 .9.3 1.8.7 2.3l.1.4-.3 1c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2z";
  paths.threads = "M12.2 22c-3 0-5.3-1-6.8-2.9C4 17.4 3.3 15 3.3 12s.7-5.4 2.1-7.1C6.9 3 9.2 2 12.2 2c2.3 0 4.2.6 5.6 1.8 1.3 1.1 2.2 2.6 2.6 4.6l-2 .5c-.7-2.9-2.8-4.4-6.2-4.4-2.4 0-4.2.8-5.3 2.2-1.1 1.4-1.6 3.2-1.6 5.3s.5 4 1.6 5.3c1.1 1.5 2.9 2.2 5.3 2.2 2.1 0 3.6-.5 4.6-1.5 1.1-1.1 1.1-2.4.8-3.2-.2-.5-.6-.9-1.1-1.2-.1.9-.4 1.7-.9 2.4-.7.9-1.7 1.4-3.1 1.5-1 .1-2-.2-2.8-.7-.9-.6-1.4-1.5-1.5-2.6-.1-2.1 1.6-3.6 4.2-3.8.9-.1 1.8 0 2.6.1-.1-.6-.3-1.1-.6-1.4-.4-.5-1.1-.7-1.9-.7-1 0-1.8.4-2.3 1.1l-1.7-1.1c.8-1.2 2.2-1.9 4-1.9 2.9 0 4.4 1.8 4.6 4.8.4.2.8.4 1.1.7 1 .8 1.6 1.9 1.8 3 .4 1.7-.1 3.7-1.6 5.2-1.4 1.4-3.4 2.1-6 2.1zm.6-9.3h-.5c-1.5.1-2.3.8-2.3 1.6.1.9 1 1.3 2 1.2 1.1-.1 2.2-.6 2.4-2.6-.5-.1-1.1-.2-1.6-.2z";
  if (!paths[name]) {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

/** Footer – layout from /cms → Online store → Footer; contact details from Store info. */
export async function Footer({ categories, settings = DEFAULT_CHROME.footer }: { categories: Category[]; settings?: Chrome["footer"] }) {
  const year = new Date().getFullYear();
  const site = await getSiteInfo(); // live business profile (/cms → Settings → Store details)
  const d = DEFAULT_CHROME.footer;
  // Untouched defaults keep following Store info (tagline, couriers) exactly as before.
  const about = settings.about === d.about ? `${site.tagline}. New, used & refurbished laptops and computer accessories from Saddar, Karachi.` : settings.about;
  // Untouched default badges show only the payment methods that are switched on (/cms → Settings → Payments)
  const isDefault = settings.paymentBadges.join("|") === d.paymentBadges.join("|");
  const payments = isDefault ? paymentsAcceptedText(await getStoreSettings().catch(() => null)).split(", ") : [];
  const badges = isDefault ? [...payments, ...site.couriers] : settings.paymentBadges;
  const copyright = settings.copyright.replaceAll("{year}", String(year)).replaceAll("{store}", site.name);
  const columns = settings.columns;
  // Link columns share the 8 grid columns next to the contact block (same widths as the built-in layout).
  const SPANS: Record<number, string[]> = { 1: ["lg:col-span-8"], 2: ["lg:col-span-4", "lg:col-span-4"], 3: ["lg:col-span-2", "lg:col-span-3", "lg:col-span-3"], 4: ["lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"] };
  return (
    <footer className="relative mt-24 border-t border-border bg-bg-elevated/60 pb-24 lg:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        {/* NAP */}
        <div className="lg:col-span-4">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">{about}</p>
          {settings.showContactInfo && (
          <address className="mt-6 space-y-3 text-sm not-italic">
            <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="flex gap-3 text-muted hover:text-fg">
              <MapPin className="mt-0.5 size-4 shrink-0 text-violet-400" aria-hidden="true" />
              {site.address.full}
            </a>
            {site.phones.map((p) => (
              <div key={p.tel} className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-violet-400" aria-hidden="true" />
                <a href={`tel:${p.tel}`} className="text-muted hover:text-fg">
                  {p.display}
                </a>
                <a
                  href={waLink(p.wa)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                >
                  <WhatsAppIcon className="size-3.5" /> WhatsApp
                </a>
              </div>
            ))}
            <a href={`mailto:${site.email}`} className="flex items-center gap-3 text-muted hover:text-fg">
              <Mail className="size-4 shrink-0 text-violet-400" aria-hidden="true" />
              {site.email}
            </a>
            <p className="flex gap-3 text-muted">
              <Clock className="mt-0.5 size-4 shrink-0 text-violet-400" aria-hidden="true" />
              {site.hoursDisplay}
            </p>
          </address>
          )}
          {settings.showSocialLinks && (
          <div className="mt-6 flex gap-2">
            {socialLinks(site).map(({ key: name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${site.name} on ${name}`}
                className="grid size-10 place-items-center rounded-full border border-border-strong text-muted transition hover:border-violet-500 hover:text-fg"
              >
                <SocialIcon name={name} />
              </a>
            ))}
          </div>
          )}
        </div>

        {columns ? (
          columns.map((col, i) => (
            <FooterCol key={`${col.title}-${i}`} title={col.title} className={SPANS[columns.length]?.[i] ?? "lg:col-span-2"}>
              {col.links.map((l, j) => (
                <li key={`${l.href}-${j}`}>
                  <Link href={l.href} {...(l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </FooterCol>
          ))
        ) : (
        <>
        <FooterCol title="Shop" className="lg:col-span-2">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} className="hover:text-fg">
                {c.name}
              </Link>
            </li>
          ))}
        </FooterCol>
        <FooterCol title="Customer Service" className="lg:col-span-3">
          {SERVICE_LINKS.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="hover:text-fg">
                {label}
              </Link>
            </li>
          ))}
        </FooterCol>
        <FooterCol title="Company" className="lg:col-span-3">
          {COMPANY_LINKS.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="hover:text-fg">
                {label}
              </Link>
            </li>
          ))}
        </FooterCol>
        </>
        )}
      </div>

      {/* Nationwide delivery – internal links to city landing pages */}
      {settings.showCityLinks && (
      <div className="container-x border-t border-border py-8">
        <p className="text-sm font-semibold text-fg">Laptop delivery all over Pakistan</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {LANDING_CITIES.map((city) => (
            <li key={city}>
              <Link href={`/laptops-in-${citySlug(city)}`} className="hover:text-fg">
                Laptops in {city}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      )}

      <div className="container-x flex flex-col gap-4 border-t border-border py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
        <p>
          {copyright} · {site.address.full}
        </p>
        <ul className="flex flex-wrap items-center gap-2" aria-label="Payment & delivery partners">
          {badges.map((m) => (
            <li key={m} className="rounded-md border border-border-strong px-2 py-1 font-semibold text-fg/80">
              {m}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

function FooterCol({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-fg">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">{children}</ul>
    </div>
  );
}
