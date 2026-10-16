import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  CreditCard,
  Globe2,
  Landmark,
  Mail,
  MessageCircle,
  Palette,
  Plus,
  Printer,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { FEATURES } from "@/lib/marketing/content";

/**
 * The homepage's feature grid: the eight features people ask about first, each with a small picture of that part of
 * the product (sample data), then the remaining four as a compact row. Every claim comes from FEATURES.
 */

const text = (id: string) => FEATURES.find((f) => f.id === id)?.text ?? "";

function Tile({ id, icon: Icon, label, title, className = "", children }: { id: string; icon: typeof Store; label: string; title: string; className?: string; children?: React.ReactNode }) {
  return (
    <article className={`mk-card mk-spot flex flex-col p-6 sm:p-7 ${className}`}>
      <p className="flex items-center gap-2 text-[13px] font-medium text-brand-200">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </p>
      <h3 className="mt-3 text-[1.35rem] font-semibold leading-tight tracking-[-0.025em] text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-body">{text(id)}</p>
      {children && (
        <div aria-hidden="true" className="mt-6 flex flex-1 flex-col justify-end">
          {children}
        </div>
      )}
    </article>
  );
}

const panel = "rounded-2xl border border-white/[0.07] bg-[#070b24]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function StoresPicture() {
  const stores = [
    { n: "Northwind Apparel", d: "northwind.shopengine.app", c: "USD", s: "Live", g: "linear-gradient(135deg,#3d86ff,#2756e8)" },
    { n: "Voltline Electronics", d: "voltline.co.uk", c: "GBP", s: "Live", g: "linear-gradient(135deg,#2dd4bf,#0f9d6b)" },
    { n: "Bloom Beauty", d: "bloom.shopengine.app", c: "PKR", s: "Trial", g: "linear-gradient(135deg,#f472b6,#c026d3)" },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <div className={`${panel} lg:col-span-2 flex flex-wrap items-center gap-2`}>
        <span className="text-[11px] text-faint">Addresses</span>
        {["northwind.shopengine.app", "voltline.co.uk", "bloom.shopengine.app"].map((d, i) => (
          <span key={d} className="mk-kbd inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-ink-2">
            <span className={`size-1.5 rounded-full ${i === 1 ? "bg-brand-sky" : "bg-ok"}`} />
            {d}
          </span>
        ))}
        <span className="text-[10.5px] text-faint">· your own domain on plans with it</span>
      </div>
      <div className={panel}>
        <p className="px-1 text-[11px] font-medium text-faint">Switch store</p>
        <ul className="mt-2 space-y-1.5">
          {stores.map((s, i) => (
            <li key={s.n} className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${i === 0 ? "bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : ""}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: s.g }}>
                {s.n[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{s.n}</span>
                <span className="block truncate text-[11px] text-faint">{s.d}</span>
              </span>
              <span className="mk-kbd hidden text-[11px] text-faint sm:inline">{s.c}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.s === "Live" ? "bg-ok-50 text-ok" : "bg-warn-50 text-warn"}`}>{s.s}</span>
              {i === 0 && <Check className="size-4 text-brand-200" />}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-2.5 py-2 text-[12px] text-faint">
          <Plus className="size-3.5" /> Open another store
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
        {[
          { k: "Stores", v: "3", d: "one sign-in" },
          { k: "Currencies", v: "3", d: "USD · GBP · PKR" },
          { k: "Shared data", v: "None", d: "isolated by design" },
        ].map((m) => (
          <div key={m.k} className={panel}>
            <p className="text-[11px] text-faint">{m.k}</p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink">{m.v}</p>
            <p className="text-[11px] text-faint">{m.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsPicture() {
  const rows = [
    { i: Banknote, t: "Cash on delivery", s: "On arrival" },
    { i: Landmark, t: "Bank transfer", s: "Receipt checked" },
    { i: Smartphone, t: "UPI · M-Pesa · PIX", s: "Your own methods" },
    { i: CreditCard, t: "Card via Stripe", s: "Provider-confirmed" },
  ];
  return (
    <ul className={`${panel} space-y-1`}>
      {rows.map((r) => (
        <li key={r.t} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <span className="grid size-7 place-items-center rounded-lg bg-white/[0.06]">
            <r.i className="size-3.5 text-ink-2" />
          </span>
          <span className="flex-1 text-[12.5px] font-medium text-ink">{r.t}</span>
          <span className="text-[10.5px] text-faint">{r.s}</span>
        </li>
      ))}
    </ul>
  );
}

function PosPicture() {
  return (
    <div className={`${panel} font-mono text-[11.5px]`}>
      <div className="flex items-center justify-between text-faint">
        <span className="flex items-center gap-1.5">
          <ScanBarcode className="size-3.5" /> Counter 1
        </span>
        <Printer className="size-3.5" />
      </div>
      <ul className="mt-2.5 space-y-1 text-ink-2">
        <li className="flex justify-between">
          <span>Linen shirt × 2</span>
          <span>$84.00</span>
        </li>
        <li className="flex justify-between">
          <span>Canvas tote</span>
          <span>$22.00</span>
        </li>
      </ul>
      <div className="my-2.5 border-t border-dashed border-white/15" />
      <div className="flex justify-between font-semibold text-ink">
        <span>Total</span>
        <span>$106.00</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-2">Cash $60</span>
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-2">Card $46</span>
      </div>
    </div>
  );
}

function OrdersPicture() {
  const steps = ["Pending", "Confirmed", "Shipped", "Delivered"];
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <span className="mk-kbd text-[11px] text-faint">NW-1042</span>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-200">Next: hand to courier</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {steps.map((s, i) => (
          <div key={s}>
            <span className={`block h-1.5 rounded-full ${i < 2 ? "bg-gradient-to-r from-[#3d86ff] to-[#7466ff]" : i === 2 ? "bg-gradient-to-r from-[#7466ff] to-white/10" : "bg-white/10"}`} />
            <span className={`mt-1.5 block text-[10.5px] ${i < 2 ? "text-ink" : "text-faint"}`}>{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2.5 py-2">
        <Truck className="size-4 text-brand-200" />
        <span className="flex-1 text-[12px] text-ink-2">Parcel 1 of 2 · tracking added</span>
        <span className="text-[10.5px] text-faint">Invoice ready</span>
      </div>
    </div>
  );
}

function ShippingPicture() {
  const zones = [
    { z: "New York City", c: "US", p: "$4.99", t: "next day" },
    { z: "Rest of the US", c: "US", p: "$9.99", t: "2–5 days" },
    { z: "Canada", c: "CA", p: "$14.50", t: "4–7 days" },
  ];
  return (
    <div className={panel}>
      <ul className="space-y-1">
        {zones.map((z) => (
          <li key={z.z} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <Globe2 className="size-3.5 text-brand-200" />
            <span className="flex-1 text-[12.5px] font-medium text-ink">{z.z}</span>
            <span className="mk-kbd rounded bg-white/[0.06] px-1.5 text-[10px] text-faint">{z.c}</span>
            <span className="w-24 text-right text-[11px] text-body">
              {z.p} · {z.t}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[11.5px]">
        <span className="text-faint">Fee tester</span>
        <span className="flex-1 truncate text-ink-2">Toronto, Canada</span>
        <span className="font-semibold text-ok">$14.50</span>
      </div>
    </div>
  );
}

function ReportsPicture() {
  const bars = [38, 52, 44, 61, 58, 72, 66, 84, 78, 92];
  return (
    <div className={panel}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-faint">Profit · this month</span>
        <span className="text-[10.5px] font-semibold text-ok">+18%</span>
      </div>
      <p className="text-lg font-semibold tracking-tight text-ink">$12,480</p>
      <div className="mt-2 flex h-16 items-end gap-1">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 rounded-t-[4px] bg-gradient-to-t from-[#3d86ff]/40 to-[#a173ff]" style={{ height: `${b}%`, opacity: 0.45 + i * 0.055 }} />
        ))}
      </div>
    </div>
  );
}

function TeamPicture() {
  const people = [
    { i: "S", n: "Sara", r: "Owner", g: "from-[#3d86ff] to-[#7466ff]" },
    { i: "M", n: "Marcus", r: "Manager", g: "from-[#2dd4bf] to-[#0f9d6b]" },
    { i: "P", n: "Priya", r: "Staff", g: "from-[#f472b6] to-[#c026d3]" },
  ];
  return (
    <ul className={`${panel} space-y-1`}>
      {people.map((p) => (
        <li key={p.n} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <span className={`grid size-7 place-items-center rounded-full bg-gradient-to-br ${p.g} text-[11px] font-semibold text-white`}>{p.i}</span>
          <span className="flex-1 text-[12.5px] font-medium text-ink">{p.n}</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-2">{p.r}</span>
          {p.r !== "Staff" && <ShieldCheck className="size-3.5 text-ok" />}
        </li>
      ))}
    </ul>
  );
}

function MessagesPicture() {
  const msgs = [
    { i: Mail, t: "Email", m: "Order NW-1042 has shipped" },
    { i: MessageCircle, t: "WhatsApp", m: "Your parcel is on its way 🚚" },
    { i: Smartphone, t: "SMS", m: "Delivered – thank you!" },
  ];
  return (
    <ul className="space-y-2">
      {msgs.map((m, i) => (
        <li key={m.t} className={`${panel} flex items-center gap-2.5 !p-2.5`} style={{ marginLeft: `${i * 10}px`, marginRight: `${(2 - i) * 10}px` }}>
          <span className="grid size-7 place-items-center rounded-lg bg-white/[0.06]">
            <m.i className="size-3.5 text-ink-2" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10.5px] text-faint">{m.t}</span>
            <span className="block truncate text-[12px] text-ink">{m.m}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StorefrontPicture() {
  const swatches = ["#3d86ff", "#7466ff", "#f472b6", "#2dd4bf", "#fbbf24"];
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-faint">Theme</span>
        <span className="flex gap-1.5">
          {swatches.map((c, i) => (
            <span key={c} className={`size-4 rounded-full ${i === 1 ? "ring-2 ring-white/70 ring-offset-2 ring-offset-[#070b24]" : ""}`} style={{ background: c }} />
          ))}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.07]">
        <div className="flex items-center justify-between bg-white/[0.04] px-3 py-2 text-[11px]">
          <span className="font-semibold text-ink">Northwind</span>
          <span className="flex gap-2 text-faint">
            <span>Shop</span>
            <span>Collections</span>
            <span>About</span>
          </span>
        </div>
        <div className="grid grid-cols-[1.2fr_1fr] gap-2 p-3">
          <div>
            <span className="block h-2 w-24 rounded bg-white/25" />
            <span className="mt-1.5 block h-2 w-16 rounded bg-white/10" />
            <span className="mt-3 inline-block rounded-full bg-[#7466ff] px-2 py-0.5 text-[9px] font-semibold text-white">Shop now</span>
          </div>
          <span className="h-14 rounded-lg bg-gradient-to-br from-[#7466ff]/50 to-[#3d86ff]/20" />
        </div>
      </div>
    </div>
  );
}

function CatalogPicture() {
  const rows = [
    { v: "Linen shirt · S · Sand", sku: "LS-S-SND", st: 24 },
    { v: "Linen shirt · M · Sand", sku: "LS-M-SND", st: 3 },
    { v: "Linen shirt · L · Navy", sku: "LS-L-NVY", st: 0 },
  ];
  return (
    <ul className={`${panel} space-y-1`}>
      {rows.map((r) => (
        <li key={r.sku} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-ink">{r.v}</span>
            <span className="mk-kbd block text-[10px] text-faint">{r.sku}</span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.st === 0 ? "bg-danger-50 text-danger" : r.st < 5 ? "bg-warn-50 text-warn" : "bg-ok-50 text-ok"}`}>{r.st === 0 ? "Out of stock" : r.st < 5 ? `Low · ${r.st}` : `${r.st} in stock`}</span>
        </li>
      ))}
    </ul>
  );
}

function BillingPicture() {
  const stages = [
    { t: "Trial", d: "14 days", on: true },
    { t: "Paid", d: "monthly or yearly", on: true },
    { t: "Grace", d: "if a payment fails", on: false },
  ];
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">Growth plan</span>
        <span className="rounded-full bg-ok-50 px-2 py-0.5 text-[10px] font-semibold text-ok">Active</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {stages.map((st) => (
          <div key={st.t}>
            <span className={`block h-1.5 rounded-full ${st.on ? "bg-gradient-to-r from-[#3d86ff] to-[#a173ff]" : "bg-white/10"}`} />
            <span className={`mt-1.5 block text-[11px] ${st.on ? "text-ink" : "text-faint"}`}>{st.t}</span>
            <span className="block text-[10px] text-faint">{st.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityPicture() {
  const rows = ["Request for store #12 – checked", "Role: manager – allowed", "Payment confirmed by provider", "Two-step verification on"];
  return (
    <ul className={`${panel} space-y-1`}>
      {rows.map((r) => (
        <li key={r} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[12px] text-ink-2">
          <span className="grid size-5 place-items-center rounded-full bg-ok-50">
            <Check className="size-3 text-ok" />
          </span>
          {r}
        </li>
      ))}
    </ul>
  );
}

/** A picture for every feature (the features page shows them next to each description). */
export const FEATURE_PICTURES: Record<string, () => React.ReactNode> = {
  "multi-store": StoresPicture,
  storefront: StorefrontPicture,
  catalog: CatalogPicture,
  orders: OrdersPicture,
  payments: PaymentsPicture,
  shipping: ShippingPicture,
  team: TeamPicture,
  pos: PosPicture,
  reports: ReportsPicture,
  billing: BillingPicture,
  notifications: MessagesPicture,
  security: SecurityPicture,
};

const MORE = [
  { id: "storefront", icon: Palette, title: "Storefront design" },
  { id: "catalog", icon: Boxes, title: "Products & stock" },
  { id: "billing", icon: BadgeCheck, title: "Plans & billing" },
  { id: "security", icon: ShieldCheck, title: "Secure by design" },
];

export function BentoFeatures() {
  return (
    <div className="mt-16">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Tile id="multi-store" icon={Store} label="Multi-store" title="Every store, one sign-in" className="mk-reveal md:col-span-2 lg:col-span-4">
          <StoresPicture />
        </Tile>
        <Tile id="payments" icon={Wallet} label="Payments" title="Get paid the way customers pay" className="mk-reveal lg:col-span-2">
          <PaymentsPicture />
        </Tile>
        <Tile id="pos" icon={ScanBarcode} label="Point of sale" title="Sell at the counter, too" className="mk-reveal lg:col-span-2">
          <PosPicture />
        </Tile>
        <Tile id="orders" icon={ClipboardList} label="Orders" title="Every order, one clear next step" className="mk-reveal lg:col-span-4">
          <OrdersPicture />
        </Tile>
        <Tile id="shipping" icon={Truck} label="Shipping" title="Deliver locally – or across borders" className="mk-reveal lg:col-span-3">
          <ShippingPicture />
        </Tile>
        <Tile id="reports" icon={ChartNoAxesCombined} label="Reports" title="Numbers in your currency" className="mk-reveal lg:col-span-3">
          <ReportsPicture />
        </Tile>
        <Tile id="team" icon={UsersRound} label="Team" title="The right access for everyone" className="mk-reveal lg:col-span-3">
          <TeamPicture />
        </Tile>
        <Tile id="notifications" icon={Mail} label="Notifications" title="Customers kept in the loop" className="mk-reveal lg:col-span-3">
          <MessagesPicture />
        </Tile>
      </div>
      <div className="mk-reveal mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MORE.map((m) => (
          <Link key={m.id} href={`/features#${m.id}`} className="mk-card mk-spot group flex items-start gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.1] to-white/[0.02] text-brand-200">
              <m.icon className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-medium text-ink">
                {m.title} <ArrowRight className="size-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
              </span>
              <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-faint">{text(m.id)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ───────────── payment methods & currencies, scrolling ───────────── */

const METHODS = ["Cash on delivery", "Bank transfer", "UPI", "M-Pesa", "PIX", "Zelle", "JazzCash", "EasyPaisa", "Cards via Stripe", "Split payments at the counter"];
const CURRENCIES = ["USD $", "EUR €", "GBP £", "PKR Rs", "INR ₹", "AED", "SAR", "KES", "NGN ₦", "BRL R$", "CAD $", "AUD $", "JPY ¥", "TRY ₺", "ZAR R", "MXN $"];

function Row({ items, reverse = false, mono = false }: { items: string[]; reverse?: boolean; mono?: boolean }) {
  const chip = `mk-chip shrink-0 whitespace-nowrap px-4 py-2 text-sm ${mono ? "mk-kbd !text-[13px]" : ""}`;
  return (
    <div className="mk-marquee overflow-hidden">
      <ul className={`mk-marquee-track flex w-max gap-3 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {items.map((t) => (
          <li key={t} className={chip}>
            {t}
          </li>
        ))}
        {items.map((t) => (
          <li key={`dup-${t}`} aria-hidden="true" className={`mk-marquee-dup ${chip}`}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PaymentsMarquee() {
  return (
    <div className="space-y-3">
      <Row items={METHODS} />
      <Row items={CURRENCIES} reverse mono />
    </div>
  );
}
