import Link from "next/link";
import { Boxes, ClipboardList, FileText, Layers, Phone, ShieldCheck, Truck } from "lucide-react";
import type { CatalogProduct } from "@/lib/types";
import { absoluteUrl, site, waLink } from "@/lib/site";
import { quoteHref, wholesaleMinQty } from "@/lib/wholesale";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";

/** Replaces the buy box on quote-only (price on request) wholesale lots: no price, no cart – quote + WhatsApp only. */
export function QuoteOnlyBox({ product: p }: { product: CatalogProduct }) {
  const w = p.wholesale ?? undefined;
  const waText = [
    `Hi ${site.name}! I'm interested in this wholesale lot:`,
    "",
    `*${p.name}*`,
    `SKU: ${p.sku}`,
    "Please share the wholesale price, photos and availability.",
    "",
    absoluteUrl(p.url),
  ].join("\n");
  const rows = [
    w?.lotSize ? { icon: Boxes, label: "Units in lot", value: `${w.lotSize} pcs` } : null,
    w?.grades ? { icon: Layers, label: "Grade", value: w.grades } : null,
    w?.contents ? { icon: ClipboardList, label: "Contents", value: w.contents } : null,
  ].filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          <span className="gradient-text">Price on request</span>
        </p>
        <p className="text-sm text-muted">
          Wholesale lot – sold by quote only. Prices depend on quantity, grade and the current dollar rate.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className={p.stock > 0 ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
            {p.stock > 0 ? `${p.stock} lot${p.stock === 1 ? "" : "s"} available` : "Next lot arriving soon – ask for availability"}
          </span>
          {p.warranty && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <ShieldCheck className="size-4 text-violet-400" aria-hidden="true" /> {p.warranty}
            </span>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="card divide-y divide-border p-0">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-3 px-4 py-3 sm:px-5">
              <r.icon className="mt-0.5 size-4 shrink-0 text-sky-400" aria-hidden="true" />
              <dt className="w-28 shrink-0 text-sm text-muted">{r.label}</dt>
              <dd className="min-w-0 text-sm font-medium text-fg">{r.value}</dd>
            </div>
          ))}
          {w?.note && <p className="px-4 py-3 text-xs text-muted sm:px-5">{w.note}</p>}
        </dl>
      )}

      <div className="space-y-2.5">
        <Link href={quoteHref(p.slug)} className="btn btn-primary btn-lg w-full">
          <FileText className="size-5" aria-hidden="true" /> Request bulk quote
        </Link>
        <a href={waLink(site.phones[0].wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg w-full">
          <WhatsAppIcon className="size-5" /> Ask for price on WhatsApp
        </a>
        <a href={`tel:${site.phones[0].tel}`} className="btn btn-ghost btn-sm w-full">
          <Phone className="size-4" aria-hidden="true" /> Call {site.phones[0].display}
        </a>
      </div>

      <ul className="glass grid gap-2 rounded-3xl p-4 text-sm text-muted sm:grid-cols-2 sm:p-5">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" /> Every unit checked &amp; tested
        </li>
        <li className="flex items-center gap-2">
          <Truck className="size-4 text-sky-400" aria-hidden="true" /> Courier / cargo all over Pakistan
        </li>
        <li className="flex items-center gap-2">
          <FileText className="size-4 text-violet-400" aria-hidden="true" /> Invoice with every bulk order
        </li>
        <li className="flex items-center gap-2">
          <Boxes className="size-4 text-amber-400" aria-hidden="true" /> Photos &amp; video of actual stock
        </li>
      </ul>
      <p className="text-xs text-subtle">
        Looking for something else in bulk? <Link href="/wholesale" className="font-semibold text-fg underline underline-offset-4">See all wholesale options</Link>
      </p>
    </div>
  );
}

/** Small call-out under the retail buy box for products that also sell in bulk. */
export function BulkQuoteNotice({ product: p }: { product: CatalogProduct }) {
  const min = wholesaleMinQty(p);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-violet-500/10 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">Buying {min}+ units? Request a wholesale quote</p>
          <p className="mt-0.5 text-sm text-muted">Special rates for shops, resellers, offices and institutes – with invoice and nationwide delivery.</p>
          <Link href={quoteHref(p.slug, Math.max(min, 10))} className="btn btn-secondary btn-sm mt-3">
            <FileText className="size-4" aria-hidden="true" /> Request bulk quote
          </Link>
        </div>
      </div>
    </div>
  );
}
