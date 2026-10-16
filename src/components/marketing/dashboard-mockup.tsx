import { BarChart3, Bell, Check, ChevronsUpDown, CreditCard, Headphones, LayoutDashboard, Package, Search, Settings, Shirt, ShoppingBag, Sparkles, TrendingUp, Users, Zap } from "lucide-react";

/**
 * The hero's product picture: a ShopEngine admin built in HTML/SVG (no screenshot to go stale), with a few live
 * moments floating around it. Sample data – labelled "Illustrative data" under the picture.
 */

const REVENUE = [21, 24, 22, 27, 26, 30, 29, 33, 31, 36, 34, 38, 37, 41, 39, 44, 43, 47, 45, 50, 49, 53, 52, 57, 55, 60, 58, 63, 62, 67];

/** A smooth line through the points (Catmull-Rom → Bézier). */
function smoothPath(values: number[], w: number, h: number, pad = 8) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, pad + (1 - (v - min) / (max - min)) * (h - pad * 2)] as const);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return { d, pts };
}

const STORES = [
  { name: "Northwind Apparel", domain: "northwind.shopengine.app", currency: "USD", status: "Live", tone: "ok", color: "linear-gradient(135deg,#3d86ff,#2756e8)", initial: "N" },
  { name: "Voltline Electronics", domain: "voltline.co.uk", currency: "GBP", status: "Live", tone: "ok", color: "linear-gradient(135deg,#2dd4bf,#0f9d6b)", initial: "V" },
  { name: "Bloom Beauty", domain: "bloom.shopengine.app", currency: "PKR", status: "Trial", tone: "warn", color: "linear-gradient(135deg,#f472b6,#c026d3)", initial: "B" },
] as const;

const ORDERS = [
  { no: "NW-1042", who: "Ava Martin", amount: "$129.00", status: "Paid", tone: "ok", icon: Shirt },
  { no: "VL-2210", who: "Oliver Hughes", amount: "£84.50", status: "Shipped", tone: "brand", icon: Headphones },
  { no: "BB-0931", who: "Ayesha Khan", amount: "Rs 7,850", status: "To confirm", tone: "warn", icon: Sparkles },
  { no: "NW-1041", who: "Liam Chen", amount: "$56.00", status: "Delivered", tone: "muted", icon: Shirt },
] as const;

const TONE: Record<string, string> = {
  ok: "bg-ok-50 text-ok",
  warn: "bg-warn-50 text-warn",
  brand: "bg-brand-100 text-brand-200",
  muted: "bg-white/[0.06] text-faint",
};

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ShoppingBag, label: "Orders", badge: "12" },
  { icon: Package, label: "Products" },
  { icon: Users, label: "Customers" },
  { icon: CreditCard, label: "Payments" },
  { icon: BarChart3, label: "Reports" },
  { icon: Settings, label: "Settings" },
];

const KPIS = [
  { k: "Revenue", v: "$48,920", d: "+12.4%", spark: [4, 6, 5, 8, 7, 9, 11] },
  { k: "Orders", v: "1,284", d: "+8.1%", spark: [5, 5, 7, 6, 8, 8, 10] },
  { k: "Avg. order", v: "$38.10", d: "+3.9%", spark: [6, 7, 6, 7, 8, 7, 9] },
  { k: "Returning", v: "31%", d: "+2.2%", spark: [3, 4, 4, 5, 5, 6, 7] },
];

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - (v / max) * 16}`).join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-14" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#7466ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardMockup() {
  const { d: line, pts } = smoothPath(REVENUE, 560, 160);
  const marker = pts[22];
  return (
    <figure className="relative">
      {/* light under the picture */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[48px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(91,72,246,0.45),transparent_70%)]" />
      <div className="mk-tilt">
        <div
          role="img"
          aria-label="ShopEngine admin dashboard: a store switcher, revenue and order figures, a 30-day revenue chart, recent orders from three stores in US dollars, pounds and rupees, and the stores' status."
          className="rounded-[22px] border border-white/10 bg-white/[0.04] p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_-30px_rgba(91,72,246,0.6),0_30px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur"
        >
          <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#070b24] text-left">
            {/* window bar */}
            <div className="flex h-10 items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
              </span>
              <span className="mx-auto hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] text-faint sm:flex">
                <span className="size-1.5 rounded-full bg-ok" /> shopengine.app/cms
              </span>
              <span className="ml-auto hidden items-center gap-2 rounded-lg border border-white/[0.07] px-2 py-1 text-[10px] text-faint md:flex sm:ml-0">
                <Search className="size-3" /> Search <span className="mk-kbd rounded border border-white/10 px-1 text-[9px]">⌘K</span>
              </span>
              <Bell className="ml-auto size-3.5 text-faint md:ml-0" />
              <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-[#3d86ff] to-[#a173ff] text-[10px] font-semibold text-white">S</span>
            </div>

            <div className="grid md:grid-cols-[188px_1fr]">
              {/* sidebar */}
              <aside className="hidden border-r border-white/[0.06] p-3 md:block">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                  <span className="grid size-7 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: STORES[0].color }}>
                    N
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-ink">Northwind Apparel</span>
                    <span className="block text-[10px] text-faint">Owner · USD</span>
                  </span>
                  <ChevronsUpDown className="size-3.5 text-faint" />
                </div>
                <ul className="mt-3 space-y-0.5">
                  {NAV.map((n) => (
                    <li key={n.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${n.active ? "bg-gradient-to-r from-brand-100 to-transparent font-semibold text-white shadow-[inset_2px_0_0_#7466ff]" : "text-body"}`}>
                      <n.icon className="size-3.5" />
                      {n.label}
                      {n.badge && <span className="ml-auto rounded-full bg-brand px-1.5 text-[9px] font-bold text-white">{n.badge}</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">Your stores</p>
                <ul className="mt-2 space-y-1.5">
                  {STORES.map((s) => (
                    <li key={s.name} className="flex items-center gap-2 px-2 text-[10.5px] text-body">
                      <span className="size-2 rounded-full" style={{ background: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-gradient-to-b from-brand-50 to-transparent p-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-ink">
                    <Zap className="size-3 text-brand-200" /> Growth plan
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-faint">1,840 of 2,000 products</p>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full w-[92%] rounded-full bg-gradient-to-r from-[#3d86ff] to-[#a173ff]" />
                  </span>
                </div>
              </aside>

              {/* main */}
              <div className="min-w-0 space-y-3 p-3 sm:p-4">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Good morning, Sara</p>
                    <p className="text-[10.5px] text-faint">Northwind Apparel · figures in USD · New York time</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-body">Last 30 days</span>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {KPIS.map((m) => (
                    <div key={m.k} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
                      <div className="flex items-start justify-between">
                        <p className="text-[10px] text-faint">{m.k}</p>
                        <Spark values={m.spark} />
                      </div>
                      <p className="mt-0.5 text-[15px] font-semibold tracking-tight text-ink">{m.v}</p>
                      <p className="mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-ok">
                        <TrendingUp className="size-2.5" />
                        {m.d}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-ink">Revenue</p>
                    <p className="flex items-center gap-3 text-[10px] text-faint">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#7466ff]" /> Online
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#38b6ff]" /> Shop counter
                      </span>
                    </p>
                  </div>
                  <div className="relative mt-2">
                    <svg viewBox="0 0 560 160" className="block h-28 w-full sm:h-36" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="mk-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#7466ff" stopOpacity="0.4" />
                          <stop offset="1" stopColor="#7466ff" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="mk-line" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0" stopColor="#3d86ff" />
                          <stop offset="0.6" stopColor="#7466ff" />
                          <stop offset="1" stopColor="#c08bff" />
                        </linearGradient>
                      </defs>
                      {[35, 80, 125].map((y) => (
                        <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
                      ))}
                      <path d={`${line} L560,160 L0,160 Z`} fill="url(#mk-area)" />
                      <path d={line} fill="none" stroke="url(#mk-line)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                      <line x1={marker[0]} x2={marker[0]} y1={marker[1]} y2="160" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#7466ff] shadow-[0_0_12px_#7466ff]" style={{ left: `${(marker[0] / 560) * 100}%`, top: `${(marker[1] / 160) * 100}%` }} />
                    <span className="absolute -translate-x-1/2 rounded-lg border border-white/10 bg-[#11173d] px-2 py-1 text-[10px] text-ink shadow-lg" style={{ left: `${(marker[0] / 560) * 100}%`, top: `calc(${(marker[1] / 160) * 100}% - 34px)` }}>
                      <span className="font-semibold">$2,140</span> <span className="text-faint">· 14 Oct</span>
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <p className="text-[11px] font-semibold text-ink">Recent orders</p>
                    <ul className="mt-2 divide-y divide-white/[0.06]">
                      {ORDERS.map((o) => (
                        <li key={o.no} className="flex items-center gap-2 py-1.5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
                            <o.icon className="size-3.5 text-ink-2" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10.5px] font-medium text-ink">{o.who}</span>
                            <span className="mk-kbd block text-[9.5px] text-faint">{o.no}</span>
                          </span>
                          <span className="text-[10.5px] font-semibold tabular-nums text-ink">{o.amount}</span>
                          <span className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:inline ${TONE[o.tone]}`}>{o.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:block">
                    <p className="text-[11px] font-semibold text-ink">Stores</p>
                    <ul className="mt-2 space-y-2">
                      {STORES.map((s) => (
                        <li key={s.name} className="flex items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: s.color }}>
                            {s.initial}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10.5px] font-medium text-ink">{s.name}</span>
                            <span className="block truncate text-[9.5px] text-faint">
                              {s.domain} · {s.currency}
                            </span>
                          </span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TONE[s.tone]}`}>{s.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* live moments from the other stores */}
      <div aria-hidden="true" className="absolute -right-6 top-16 hidden w-64 animate-float rounded-2xl border border-white/10 bg-[#0b1033]/90 p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:block xl:-right-14">
        <div className="flex items-center gap-3">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-ok-50 text-ok">
            <ShoppingBag className="size-4" />
            <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse-soft rounded-full bg-ok" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold text-ink">New order · Voltline</span>
            <span className="block text-[10.5px] text-faint">£84.50 · card payment confirmed</span>
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="absolute -left-6 top-[64%] hidden w-60 animate-float-slow rounded-2xl border border-white/10 bg-[#0b1033]/90 p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl [animation-delay:-3s] lg:block xl:-left-14">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: STORES[2].color }}>
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold text-ink">Bloom Beauty is live</span>
            <span className="block truncate text-[10.5px] text-faint">bloom.shopengine.app</span>
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="absolute -bottom-6 right-[12%] hidden w-64 animate-float rounded-2xl border border-white/10 bg-[#0b1033]/90 p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl [animation-delay:-1.5s] md:block">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-200">
            <Check className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold text-ink">Bank transfer approved</span>
            <span className="block text-[10.5px] text-faint">Rs 7,850 · order BB-0931</span>
          </span>
        </div>
      </div>
      <figcaption className="mt-12 text-center text-xs text-faint">Illustrative data</figcaption>
    </figure>
  );
}
