import type { Metadata } from "next";
import { Gift, PackageCheck, Truck, Wallet } from "lucide-react";
import { PolicyLayout } from "@/components/content/policy-layout";
import { Markdown } from "@/components/ui/markdown";
import { InlineText } from "@/components/content/inline-text";
import { getPageMeta } from "@/lib/page-seo";
import { getResolvedPageContent } from "@/lib/repo/site-content";
import { moneyFormatter } from "@/lib/money";
import { getStoreLocale } from "@/lib/store-locale";
import { deliveryCharge, deliveryEstimate } from "@/lib/cities";
import { countryName } from "@/lib/locale";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/shipping-policy");
}

export default async function ShippingPolicyPage() {
  const [c, loc] = await Promise.all([getResolvedPageContent("/shipping-policy"), getStoreLocale()]);
  const { settings: s, info: site } = c;
  // amounts in the store's currency; the Karachi / Pakistani cities wording only for a store in Pakistan
  const money = moneyFormatter(loc);
  const pk = loc.country === "PK";
  const charge = (city: string) => money(deliveryCharge(city, 0, s));
  const free = money(s.freeDeliveryThreshold);
  const restAreas = `All other cities, towns and areas served by our courier partners${pk ? ", including AJK and Gilgit-Baltistan" : ""}`;

  // Zones from /cms → Delivery & payments → Delivery charges (the same ones checkout uses); old defaults otherwise
  // a zone abroad names its countries
  const names = (codes: string[]) => codes.map((c) => countryName(c)).join(", ");
  const rows = s.zones?.length
    ? s.zones.map((z) => ({
        zone: z.name,
        areas: z.countries?.length
          ? z.rest
            ? `All of ${names(z.countries)}`
            : `${names(z.countries)}: ${[...z.cities, ...(z.places ?? [])].join(", ")}`
          : z.rest
            ? restAreas
            : [...z.cities, ...(z.places ?? [])].join(", "),
        time: z.estimate?.trim() || (z.countries?.length ? deliveryEstimate("", s, "", z.countries[0]).label : z.rest ? (pk ? "3–5 working days" : deliveryEstimate("", s).label) : deliveryEstimate(z.cities[0] ?? z.places?.[0] ?? "", s).label),
        fee: `${money(z.charge)}${z.freeAbove != null && z.freeAbove !== s.freeDeliveryThreshold ? (z.freeAbove > 0 ? ` (free over ${money(z.freeAbove)})` : " (never free)") : ""}`,
      }))
    : pk
      ? [
          { zone: "Karachi", areas: "All areas of Karachi incl. DHA, Clifton, Gulshan, North Nazimabad, Korangi, Malir", time: "Same day / next day", fee: charge("Karachi") },
          { zone: "Major cities", areas: "Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad, Sialkot, Gujranwala, Sukkur", time: "1–3 working days", fee: `${charge("Lahore")} – ${money(s.defaultDeliveryCharge)}` },
          { zone: "Other cities & towns", areas: restAreas, time: "3–5 working days", fee: money(s.defaultDeliveryCharge) },
        ]
      : [{ zone: "All areas", areas: "All cities, towns and areas served by our courier partners", time: deliveryEstimate("", s).label, fee: money(s.defaultDeliveryCharge) }];

  // Policy text: /cms → Online store → Page texts (defaults in src/lib/content/page-defaults.ts).

  return (
    <PolicyLayout path="/shipping-policy" name="Shipping Policy" eyebrow={c.eyebrow || undefined} title={<InlineText text={c.title} />} description={c.description} updated={c.updated}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          pk ? { icon: Truck, t: "Karachi same / next day", d: "Major cities 1–3 days" } : { icon: Truck, t: "Fast, tracked delivery", d: deliveryEstimate("", s).label },
          { icon: Gift, t: `Free delivery over ${free}`, d: "On every order" },
          { icon: Wallet, t: "Cash on Delivery", d: pk ? "All over Pakistan" : "Nationwide" },
          { icon: PackageCheck, t: "Tracked & safely packed", d: "Bubble wrap + box" },
        ].map((b) => (
          <li key={b.t} className="card flex items-center gap-3 p-4">
            <b.icon className="size-6 shrink-0 text-sky-400" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-fg">{b.t}</span>
              <span className="block text-xs text-muted">{b.d}</span>
            </span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="times-heading">
        <h2 id="times-heading" className="mb-4 text-2xl font-bold text-fg">
          Delivery times & charges
        </h2>
        <div className="prose-store">
          <table>
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col">Cities / areas</th>
                <th scope="col">Delivery time</th>
                <th scope="col">Charge (under {free})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.zone}>
                  <td className="font-semibold text-fg">{r.zone}</td>
                  <td>{r.areas}</td>
                  <td className="whitespace-nowrap">{r.time}</td>
                  <td className="whitespace-nowrap">{r.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Orders of <strong className="text-fg">{free}</strong> or more ship free. Working days are Monday to Saturday, excluding public holidays.
        </p>
        {(s.shipTo ?? []).filter((c) => c !== loc.country).length > 0 && (
          <p className="mt-2 text-sm text-muted">
            We also deliver to <strong className="text-fg">{names((s.shipTo ?? []).filter((c) => c !== loc.country))}</strong> – choose your country at checkout.
          </p>
        )}
      </section>

      <section aria-labelledby="couriers-heading">
        <h2 id="couriers-heading" className="mb-4 text-2xl font-bold text-fg">
          Our courier partners
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {site.couriers.map((c) => (
            <li key={c} className="card grid h-16 place-items-center font-display text-lg font-bold text-muted">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <Markdown content={c.body} className="card p-6 sm:p-10" />
    </PolicyLayout>
  );
}
