import Link from "next/link";
import {
  ArrowUpRight, BadgeCheck, Battery, Camera, ClipboardCheck, PackageCheck, RotateCcw, ShieldCheck, Truck, Wallet,
} from "lucide-react";
import type { Brand, CatalogProduct, LaptopModel, SpecRow } from "@/lib/types";
import { cn, conditionMeta } from "@/lib/utils";
import type { DeliveryInfo } from "@/lib/cities";
import { moneyFormatter } from "@/lib/money";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getStoreLocale } from "@/lib/store-locale";
import { WhatsAppLink } from "@/components/content/whatsapp-link";
import { ConditionBadge } from "@/components/ui/condition-badge";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";

/** Condition badge + description + notes (battery health etc.) – highlighted for used / refurbished stock. */
export function ConditionPanel({ product: p }: { product: CatalogProduct }) {
  if (!p.condition) return null;
  const m = conditionMeta[p.condition];
  const highlighted = p.condition !== "new" || !!p.conditionNotes;
  if (!highlighted) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ConditionBadge condition={p.condition} long /> {m.description}
      </p>
    );
  }
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-sky-500/20 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-strong">
          <ClipboardCheck className="size-5 text-sky-400" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Condition</span>
            <ConditionBadge condition={p.condition} long />
          </div>
          <p className="text-sm text-fg/90">{m.description}</p>
          {p.conditionNotes && (
            <p className="flex items-start gap-2 rounded-2xl bg-surface-strong px-3 py-2 text-sm font-medium text-fg">
              <Battery className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              {p.conditionNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Trust badges under a product – return period and Cash on Delivery follow /cms → Settings. */
export async function TrustStrip({ className, returnDays, cod }: { className?: string; returnDays: number; cod: boolean }) {
  const pk = (await getStoreLocale()).country === "PK"; // Pakistani wallets / "all over Pakistan" only there
  const TRUST = [
    cod
      ? { icon: Wallet, title: "Cash on Delivery", text: "Pay when it arrives", tone: "text-emerald-400" }
      : { icon: Wallet, title: "Easy payment", text: pk ? "JazzCash, EasyPaisa or bank" : "Online or bank transfer", tone: "text-emerald-400" },
    { icon: Truck, title: pk ? "All over Pakistan" : "Nationwide delivery", text: "Delivery to every city", tone: "text-sky-400" },
    { icon: ShieldCheck, title: "Warranty", text: "Checking + store warranty", tone: "text-violet-400" },
    { icon: BadgeCheck, title: "Checked & tested", text: "30+ point inspection", tone: "text-amber-400" },
    { icon: RotateCcw, title: "Easy returns", text: `Within ${days(returnDays)}`, tone: "text-rose-400" },
  ];
  return (
    <ul className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5", className)} aria-label="Why buy from us">
      {TRUST.map((t, i) => (
        <li key={t.title} className={cn("flex items-center gap-3 rounded-2xl border border-border bg-surface p-3", i === 4 && "col-span-2 sm:col-span-1")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-strong">
            <t.icon className={cn("size-5", t.tone)} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-fg">{t.title}</span>
            <span className="block text-xs text-muted">{t.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SpecsTable({ specs }: { specs: SpecRow[] }) {
  if (!specs.length) return <p className="text-muted">Ask us on WhatsApp for the full specifications of this item.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Technical specifications</caption>
        <tbody>
          {specs.map((s, i) => (
            <tr key={s.label + i} className={cn("border-border", i > 0 && "border-t", i % 2 === 0 && "bg-surface")}>
              <th scope="row" className="w-2/5 px-4 py-3 align-top font-medium text-muted sm:w-1/3 sm:px-5">
                {s.label}
              </th>
              <td className="px-4 py-3 font-medium text-fg sm:px-5">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompatibilityList({ product, models, brands }: { product: CatalogProduct; models: LaptopModel[]; brands: Brand[] }) {
  const ids = new Set(product.compatibility);
  const compatible = models.filter((m) => ids.has(m.id));
  const brandName = new Map(brands.map((b) => [b.slug, b.name]));
  const groups = new Map<string, LaptopModel[]>();
  for (const m of compatible) groups.set(m.brand, [...(groups.get(m.brand) ?? []), m]);
  const unknown = product.compatibility.filter((id) => !compatible.some((m) => m.id === id));

  return (
    <div className="space-y-6">
      <p className="text-muted">
        This {product.categoryName.toLowerCase() || "part"} is compatible with the following laptop models. Tap a model to see every part we stock for it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[...groups.entries()].map(([brand, list]) => (
          <div key={brand} className="rounded-2xl border border-border bg-bg-elevated/60 p-4">
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-fg">{brandName.get(brand) ?? brand}</h3>
            <ul className="flex flex-wrap gap-2">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/find-parts?model=${encodeURIComponent(m.id)}`}
                    className="group inline-flex min-h-10 items-center gap-1 rounded-full border border-border bg-surface px-3.5 text-sm text-fg transition hover:border-violet-500/60 hover:bg-violet-500/10"
                  >
                    {m.name}
                    <ArrowUpRight className="size-3.5 text-muted transition group-hover:text-violet-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {unknown.length > 0 && (
          <div className="rounded-2xl border border-border bg-bg-elevated/60 p-4">
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-fg">Also fits</h3>
            <p className="text-sm text-muted">{unknown.map((id) => id.replace(/-/g, " ")).join(", ")}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-sm text-fg">
          <Camera className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          Not sure? WhatsApp us a photo of your laptop&apos;s bottom label (or old part) and we&apos;ll confirm compatibility in minutes.
        </p>
        <WhatsAppLink
          message={`Hi! Will "${product.name}" fit my laptop? I'm sending a photo of the label.`}
          className="btn btn-whatsapp btn-sm shrink-0"
        >
          <WhatsAppIcon className="size-4" /> Confirm fit
        </WhatsAppLink>
      </div>
    </div>
  );
}

/** Delivery times: the shipping zones' own estimates when set in /cms, otherwise the built-in ones (Pakistani cities for the original shop). */
function deliveryText(delivery: DeliveryInfo, pk: boolean) {
  const zones = (delivery.zones ?? []).filter((z) => z.estimate?.trim());
  if (!zones.length)
    return pk
      ? "Karachi: same / next day. Lahore, Islamabad & major cities: 1–3 working days. Other cities: 3–5 working days via TCS, Leopards, M&P or PostEx."
      : "We deliver to every city – the delivery time for yours is confirmed with your order.";
  return zones.map((z) => `${z.rest ? "Other cities" : z.name}: ${z.estimate!.trim()}`).join(". ") + ".";
}

export async function WarrantyDelivery({ product, returnDays, delivery }: { product: CatalogProduct; returnDays: number; delivery: DeliveryInfo }) {
  const { address } = await getSiteInfo(); // where the store is (Settings → Store details)
  const locale = await getStoreLocale();
  const money = moneyFormatter(locale);
  const pk = locale.country === "PK"; // Pakistani wallets / "all over Pakistan" only there
  const rows = [
    { icon: ShieldCheck, title: "Warranty", text: `${product.warranty}. Keep the box and invoice – warranty claims are handled at our ${address.area ? `${address.area} ` : ""}store or via courier.` },
    { icon: PackageCheck, title: "Checked before dispatch", text: "Every item is tested and packed with bubble wrap and a sealed box. We share a video/photo before dispatch on request." },
    { icon: Truck, title: pk ? "Delivery all over Pakistan" : "Delivery nationwide", text: deliveryText(delivery, pk) },
    delivery.cod.enabled
      ? {
          icon: Wallet,
          title: "Cash on Delivery",
          text: `Pay cash when you receive your parcel${delivery.cod.maxOrder ? ` (orders up to ${money(delivery.cod.maxOrder)})` : ""}. ${pk ? "JazzCash, EasyPaisa" : "Online payment"} and bank transfer are also available.`,
        }
      : { icon: Wallet, title: "Payment", text: `Pay ${pk ? "by JazzCash, EasyPaisa or bank transfer" : "online or by bank transfer"} – we confirm your payment before dispatch.` },
    { icon: RotateCcw, title: "Easy returns", text: `Faulty or not as described? Report within ${days(returnDays)} of delivery for a replacement or refund.` },
  ];
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.title} className="flex gap-3 rounded-2xl border border-border bg-bg-elevated/60 p-4">
            <r.icon className="mt-0.5 size-5 shrink-0 text-violet-400" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-fg">{r.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Read the full{" "}
        <Link href="/warranty-returns" className="font-semibold text-fg underline decoration-violet-500/60 underline-offset-4">
          warranty &amp; returns policy
        </Link>{" "}
        and{" "}
        <Link href="/shipping-policy" className="font-semibold text-fg underline decoration-violet-500/60 underline-offset-4">
          shipping policy
        </Link>
        .
      </p>
    </div>
  );
}
