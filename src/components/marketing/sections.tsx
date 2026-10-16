import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  CreditCard,
  Fingerprint,
  KeyRound,
  Lock,
  Palette,
  Plus,
  Rocket,
  ScanBarcode,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { AUDIENCES, SECURITY_POINTS, SITE, STEPS, type Faq, type IconName } from "@/lib/marketing/content";

export const ICONS: Record<IconName, typeof Store> = {
  Store,
  Palette,
  Boxes,
  ClipboardList,
  CreditCard,
  Truck,
  UsersRound,
  ScanBarcode,
  ChartNoAxesCombined,
  BadgeCheck,
  BellRing,
  ShieldCheck,
};

/* ───────────── building blocks ───────────── */

export function SectionHeader({ eyebrow, title, lead, center = true, id, className = "" }: { eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode; center?: boolean; id?: string; className?: string }) {
  return (
    <div className={`mk-reveal ${center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`}>
      {eyebrow && <p className="mk-eyebrow">{eyebrow}</p>}
      <h2 id={id} className="mk-h2 mt-5">
        {title}
      </h2>
      {lead && <p className={`mk-lead mt-5 ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>{lead}</p>}
    </div>
  );
}

export function IconTile({ icon: Icon, className = "" }: { icon: typeof Store; className?: string }) {
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.1] to-white/[0.02] text-brand-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${className}`}>
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  );
}

export function FeatureIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return <IconTile icon={ICONS[name]} className={className} />;
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-faint">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="transition-colors hover:text-white">
            Home
          </Link>
        </li>
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-white/20">
              /
            </span>
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-ink-2">
                {it.name}
              </span>
            ) : (
              <Link href={it.path} className="transition-colors hover:text-white">
                {it.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Lit backdrop for the top of a page (sits under the floating header). */
export function HeroBackdrop({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`mk-aurora absolute inset-x-0 top-0 ${tall ? "h-[900px]" : "h-[620px]"}`} />
      <div className={`mk-grid-bg absolute inset-x-0 top-0 ${tall ? "h-[760px]" : "h-[560px]"}`} />
      <div className="absolute left-1/2 top-0 h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night" />
    </div>
  );
}

/** The top of an inner page: breadcrumbs, H1 and lead on the lit backdrop. */
export function PageHero({ eyebrow, title, lead, crumbs, children, center = false }: { eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode; crumbs: { name: string; path: string }[]; children?: React.ReactNode; center?: boolean }) {
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackdrop />
      {!center && (
        <div aria-hidden="true" className="pointer-events-none absolute right-[max(2rem,calc((100vw-1240px)/2+2rem))] top-40 hidden xl:block">
          <div className="relative grid size-[300px] place-items-center">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(116,102,255,0.35),transparent_65%)]" />
            <div className="absolute inset-6 rounded-full border border-white/[0.06]" />
            <div className="absolute inset-16 rounded-full border border-white/[0.08]" />
            <span className="relative grid size-28 animate-float place-items-center rounded-[32px] border border-white/15 bg-gradient-to-b from-white/[0.12] to-white/[0.02] shadow-[0_0_80px_-10px_rgba(116,102,255,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]">
              <Image src="/brand/shopengine/icon.png" alt="" width={64} height={64} sizes="64px" />
            </span>
          </div>
        </div>
      )}
      <div className="mk-container relative pb-16 pt-32 sm:pb-20 sm:pt-40">
        <div className={center ? "flex justify-center" : ""}>
          <Breadcrumbs items={crumbs} />
        </div>
        <div className={`mt-10 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
          {eyebrow && <p className="mk-eyebrow animate-rise">{eyebrow}</p>}
          <h1 className="mk-h1 mt-5 animate-rise text-[clamp(2.4rem,5.4vw,4.4rem)] [animation-delay:60ms]">{title}</h1>
          {lead && <p className="mk-lead mt-6 animate-rise [animation-delay:120ms]">{lead}</p>}
          {children && <div className="animate-rise [animation-delay:180ms]">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/* ───────────── one engine, independent stores ───────────── */

const DIAGRAM_STORES = [
  { name: "Fashion store", domain: "northwind.shopengine.app", currency: "USD $", color: "linear-gradient(135deg,#3d86ff,#2756e8)" },
  { name: "Electronics store", domain: "voltline.co.uk", currency: "GBP £", color: "linear-gradient(135deg,#2dd4bf,#0f9d6b)" },
  { name: "Beauty store", domain: "bloom.shopengine.app", currency: "PKR Rs", color: "linear-gradient(135deg,#f472b6,#c026d3)" },
];
const OWN = ["Brand, theme & domain", "Products & prices", "Customers & orders", "Payments & delivery", "Team & settings"];
const ENGINE = ["Subscriptions & billing", "Store data isolation", "Platform administration", "Payments & messaging"];

export function MultiStoreDiagram() {
  return (
    <figure className="mk-reveal relative mt-16">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
        {DIAGRAM_STORES.map((s) => (
          <div key={s.name} className="mk-card mk-spot p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]" style={{ background: s.color }}>
                <Store className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{s.name}</span>
                <span className="block truncate text-xs text-faint">{s.domain}</span>
              </span>
              <span className="mk-kbd rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink-2">{s.currency}</span>
            </div>
            <ul className="mt-5 grid gap-2">
              {OWN.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm text-body">
                  <Check className="size-3.5 shrink-0 text-ok" aria-hidden="true" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* the links down to the engine, with data flowing along them */}
      <svg aria-hidden="true" viewBox="0 0 1200 140" preserveAspectRatio="none" className="hidden h-[120px] w-full lg:block">
        <defs>
          <linearGradient id="mk-flow-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d86ff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#a173ff" />
          </linearGradient>
        </defs>
        {["M195,0 C195,80 600,60 600,140", "M600,0 L600,140", "M1005,0 C1005,80 600,60 600,140"].map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="url(#mk-flow-g)" strokeWidth="2" vectorEffect="non-scaling-stroke" className="mk-flow" />
          </g>
        ))}
      </svg>

      <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0e2c] p-6 sm:p-8 lg:mt-0">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(116,102,255,0.35),transparent_70%)]" />
        <div aria-hidden="true" className="mk-dots-bg absolute inset-0 opacity-60" />
        <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="flex items-center gap-4">
            <span className="relative grid size-16 place-items-center rounded-2xl border border-white/15 bg-white/[0.06] shadow-[0_0_40px_-5px_rgba(116,102,255,0.8)]">
              <Image src="/brand/shopengine/icon.png" alt="" width={40} height={40} sizes="40px" />
            </span>
            <span>
              <span className="block text-sm font-medium text-brand-200">ShopEngine core</span>
              <span className="block text-xl font-semibold tracking-tight text-white">The engine behind every store</span>
            </span>
          </div>
          <ul className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
            {ENGINE.map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink-2">
                <span className="size-1.5 rounded-full bg-gradient-to-br from-[#38b6ff] to-[#a173ff]" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="sr-only">Three independent stores – each with its own brand, domain, currency, products, orders, customers, payments, team and settings – all running on ShopEngine, which handles subscriptions, data isolation, platform administration and payment and messaging infrastructure.</figcaption>
    </figure>
  );
}

/* ───────────── how it works ───────────── */

const STEP_ICONS = [UserPlus, Store, Settings2, Rocket];

export function Steps({ detailed = false }: { detailed?: boolean }) {
  return (
    <ol className="mk-reveal relative mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-[2.1rem] hidden h-px bg-gradient-to-r from-[#3d86ff]/0 via-[#7466ff]/60 to-[#a173ff]/0 lg:block" />
      {STEPS.map((s, i) => {
        const Icon = STEP_ICONS[i];
        return (
          <li key={s.title} className="mk-card mk-spot relative p-6 lg:pt-5">
            <div className="flex items-center justify-between">
              <span className="relative z-10 grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#3d86ff] via-[#5b48f6] to-[#a173ff] text-white shadow-[0_0_30px_-4px_rgba(116,102,255,0.9)]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mk-kbd text-xs text-faint">0{i + 1}</span>
            </div>
            <h3 className="mk-h3 mt-6">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{s.text}</p>
            {detailed && i === 0 && (
              <Link href={SITE.signUp} className="mk-link mt-4 inline-flex items-center gap-1 text-sm">
                Create an account <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────── business models ───────────── */

const AUDIENCE_ICONS: Record<string, typeof Store> = { entrepreneurs: Rocket, "multi-brand": Store, retail: ScanBarcode, agencies: UsersRound };

export function Audiences() {
  return (
    <div className="mk-reveal mt-16 grid gap-4 md:grid-cols-2">
      {AUDIENCES.map((a) => (
        <article key={a.id} className="mk-card mk-spot flex flex-col p-6 sm:p-8">
          <IconTile icon={AUDIENCE_ICONS[a.id] ?? Store} />
          <h3 className="mt-6 text-xl font-semibold tracking-tight text-ink">{a.title}</h3>
          <p className="mk-text mt-2">{a.text}</p>
          <ul className="mt-5 grid gap-2.5">
            {a.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-ink-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-100">
                  <Check className="size-2.5 text-brand-200" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          {a.href && (
            <Link href={a.href} className="mk-link mt-auto inline-flex items-center gap-1 pt-6 text-sm">
              Learn more <span className="sr-only">about ShopEngine for {a.title.toLowerCase()}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}

/* ───────────── security ───────────── */

const SECURITY_ICONS = [Lock, KeyRound, Fingerprint, BadgeCheck, Boxes, BellRing];

export function SecurityGrid() {
  return (
    <ul className="mk-reveal mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SECURITY_POINTS.map((p, i) => {
        const Icon = SECURITY_ICONS[i] ?? Lock;
        return (
          <li key={p.title} className="mk-card mk-spot p-6">
            <IconTile icon={Icon} />
            <h3 className="mk-h3 mt-5">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{p.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Concentric rings around a shield – the four protections on orbit. */
export function SecurityVisual() {
  const tags = [
    { t: "Store isolation", pos: "left-[2%] top-[16%]" },
    { t: "Role checks", pos: "right-[0%] top-[30%]" },
    { t: "Two-step sign-in", pos: "left-[6%] bottom-[18%]" },
    { t: "Verified payments", pos: "right-[4%] bottom-[8%]" },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[460px]">
      {[100, 74, 48].map((size, i) => (
        <div
          key={size}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]"
          style={{ width: `${size}%`, height: `${size}%`, background: i === 2 ? "radial-gradient(circle, rgba(116,102,255,0.28), transparent 70%)" : undefined }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 size-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(116,102,255,0.5),transparent_65%)]" />
      <span className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[28px] border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.03] shadow-[0_0_60px_-5px_rgba(116,102,255,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]">
        <ShieldCheck className="size-11 text-white" strokeWidth={1.6} />
      </span>
      {tags.map((g, i) => (
        <span key={g.t} className={`absolute ${g.pos} flex animate-float items-center gap-2 rounded-full border border-white/10 bg-[#0b1033]/90 px-3 py-1.5 text-xs font-medium text-ink-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)]`} style={{ animationDelay: `${-i * 1.7}s` }}>
          <span className="size-1.5 rounded-full bg-ok shadow-[0_0_8px_#34d399]" />
          {g.t}
        </span>
      ))}
    </div>
  );
}

/* ───────────── comparison (the problem) ───────────── */

export function Comparison() {
  const without = ["A separate admin and login for each shop", "Stock counted in spreadsheets", "A different till for the shop counter", "Payment details pasted into chats", "Staff sharing one password"];
  const withSE = ["One sign-in, a switcher for every store", "Stock shared by the website and the counter", "Point of sale on the same products", "Checkout with the methods your customers use", "A role per person, per store"];
  return (
    <div className="mk-reveal grid gap-4 sm:grid-cols-2">
      <div className="mk-card p-6">
        <p className="text-sm font-medium text-faint">Without one platform</p>
        <ul className="mt-5 space-y-2.5">
          {without.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm text-faint">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-danger-50">
                <X className="size-3 text-danger" aria-hidden="true" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="mk-card mk-glow-edge relative overflow-hidden p-6">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(116,102,255,0.22),transparent_70%)]" />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-200">
            <Image src="/brand/shopengine/favicon-32.png" alt="" width={16} height={16} /> With ShopEngine
          </p>
          <ul className="mt-5 space-y-2.5">
            {withSE.map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok-50">
                  <Check className="size-3 text-ok" aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ───────────── FAQ ───────────── */

export function FaqList({ items, className = "" }: { items: Faq[]; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((f) => (
        <details key={f.q} className="mk-card group overflow-hidden !rounded-2xl transition-colors open:border-white/15 open:bg-white/[0.035]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[0.975rem] font-medium text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-transform duration-300 group-open:rotate-45">
              <Plus className="size-3.5 text-ink-2" aria-hidden="true" />
            </span>
          </summary>
          <p className="px-5 pb-5 pr-12 text-[0.9375rem] leading-relaxed text-body sm:px-6">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ───────────── final call to action ───────────── */

export function CtaBand({ title = "Your next store starts here.", text = "Bring your storefronts, operations and growth plans together with ShopEngine." }: { title?: string; text?: string }) {
  return (
    <section className="mk-section pt-10">
      <div className="mk-container">
        <div className="mk-reveal relative isolate overflow-hidden rounded-[32px] border border-white/10 px-6 py-20 text-center sm:px-12 sm:py-28">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#080c2a]" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_50%_100%,rgba(91,72,246,0.55),transparent_70%),radial-gradient(40%_60%_at_15%_0%,rgba(61,134,255,0.3),transparent_70%),radial-gradient(40%_60%_at_85%_0%,rgba(161,115,255,0.3),transparent_70%)]" />
          <div aria-hidden="true" className="mk-grid-bg absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,#000_20%,transparent_100%)]" />
          <span aria-hidden="true" className="mx-auto grid size-16 animate-float place-items-center rounded-2xl border border-white/15 bg-white/[0.06] shadow-[0_0_50px_-5px_rgba(116,102,255,0.9)]">
            <Image src="/brand/shopengine/icon.png" alt="" width={40} height={40} sizes="40px" />
          </span>
          <h2 className="mk-h2 mx-auto mt-8 max-w-3xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-body">{text}</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={SITE.signUp} className="mk-btn mk-btn-light mk-btn-lg">
              Start free trial <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/features" className="mk-btn mk-btn-secondary mk-btn-lg">
              Explore the platform
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
