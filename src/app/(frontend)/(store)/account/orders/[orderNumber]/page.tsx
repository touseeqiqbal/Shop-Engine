import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, MapPin, MessageCircle, PackageCheck, RotateCcw, Truck } from "lucide-react";
import { AccountNav } from "@/components/account/account-ui";
import { BuyAgain } from "@/components/account/buy-again";
import { getSessionUser } from "@/lib/auth";
import { courierInfo, courierTrackingUrl } from "@/lib/couriers";
import { cityLine, ORDER_FLOW, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, paymentLabel } from "@/lib/order-display";
import { paidOnDelivery } from "@/lib/order-money";
import { amountToCollect, creditedAdvance } from "@/lib/order-money";
import { ORDER_NUMBER_RE } from "@/lib/order-number";
import { getProductsByIds } from "@/lib/repo/catalog";
import { getSiteInfo } from "@/lib/repo/site-content";
import { pageMetadata } from "@/lib/seo";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import { buyLimit, canOrder, cn, shipsLater } from "@/lib/utils";
import { moneyFormatter } from "@/lib/money";
import { getStoreLocale } from "@/lib/store-locale";
import { formatDate, formatDateTime } from "@/lib/time";
import { loadViewableOrder } from "../load";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ orderNumber }, { name }, locale] = await Promise.all([params, getSiteInfo(), getStoreLocale()]);
  return pageMetadata({ title: `Order ${decodeURIComponent(orderNumber).toUpperCase()} | ${name}`, description: "Your order details, delivery status and invoice.", path: "/account/orders", noindex: true, locale });
}

const STOPPED = new Set(["cancelled", "refused", "returned"]);
const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
};

export default async function OrderDetailPage({ params }: Props) {
  const n = safeDecode((await params).orderNumber).toUpperCase();
  if (!ORDER_NUMBER_RE.test(n)) notFound();
  const found = await loadViewableOrder(n);
  if (!found) {
    if (!(await getSessionUser().catch(() => null))) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${n}`)}`);
    notFound();
  }
  const { order, signedIn } = found;

  // "Buy again": the same items at today's price – only what is still for sale
  const [products, site, loc] = await Promise.all([getProductsByIds(order.items.map((i) => i.productId)), getSiteInfo(), getStoreLocale()]);
  // amounts and dates in the store's currency and time zone
  const money = moneyFormatter(loc);
  const current = new Map(products.map((p) => [p.id, p]));
  const lines = order.items.flatMap((i) => {
    const p = current.get(i.productId);
    if (!p || p.priceOnRequest || !canOrder(p)) return [];
    const upgrades = (i.upgrades ?? []).filter((u) => p.upgrades?.some((x) => x.id === u.id)).map((u) => p.upgrades!.find((x) => x.id === u.id)!);
    return [{ product: p, qty: Math.min(i.qty, Math.max(1, buyLimit(p))), upgrades }];
  });
  const unavailable = order.items.filter((i) => !lines.some((l) => l.product.id === i.productId)).map((i) => i.name);

  const stepIndex = ORDER_FLOW.indexOf(order.status);
  const stopped = STOPPED.has(order.status);
  const advance = creditedAdvance(order);
  const due = amountToCollect(order);
  const courier = courierInfo(order.courier)?.name ?? order.courier ?? null;
  const trackUrl = courierTrackingUrl(order.courier, order.trackingNumber);
  // status and time only – team notes stay private
  const timeline = [...(order.history ?? [])].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link href="/account/orders" className="hover:text-fg">
              My orders
            </Link>{" "}
            / {order.orderNumber}
          </p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Order <span className="gradient-text">{order.orderNumber}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Placed {formatDate(order.createdAt, loc)}</p>
        </div>
        <span className={cn("chip text-sm", stopped ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-violet-500/40 bg-violet-500/10 text-violet-200")}>{ORDER_STATUS_LABEL[order.status]}</span>
      </div>
      {signedIn && <AccountNav />}

      {/* progress */}
      {!stopped && stepIndex >= 0 && (
        <section className="card p-5 sm:p-6" aria-label="Delivery progress">
          <ol className="grid grid-cols-5 gap-2 text-center text-xs sm:text-sm">
            {ORDER_FLOW.map((s, i) => (
              <li key={s} className="space-y-2">
                <span className={cn("mx-auto block h-1.5 rounded-full", i <= stepIndex ? "bg-brand-gradient" : "bg-surface-strong")} aria-hidden="true" />
                <span className={i <= stepIndex ? "font-semibold text-fg" : "text-muted"}>{ORDER_STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="items-h">
            <h2 id="items-h" className="font-display text-lg font-bold">
              Items
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((i, idx) => (
                <li key={`${i.productId}-${idx}`} className="flex items-center gap-3 py-3">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {i.image && <Image src={i.image} alt={i.name} fill sizes="64px" className="object-contain p-1" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {i.url ? (
                      <Link href={i.url} className="font-medium hover:text-violet-300">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="font-medium">{i.name}</p>
                    )}
                    {i.upgrades?.length ? <p className="text-xs text-muted">{i.upgrades.map((u) => u.label).join(" · ")}</p> : null}
                    {i.availability ? <p className="text-xs font-medium text-violet-300">{shipsLater(i)}</p> : null}
                    <p className="text-xs text-muted">
                      {i.qty} × {money(i.unitPrice)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{money(i.qty * i.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${money(order.discount)}`} />}
              <Row label="Delivery" value={order.deliveryCharge ? money(order.deliveryCharge) : "Free"} />
              <Row label="Total" value={money(order.total)} strong />
              {(order.giftCardAmount ?? 0) > 0 && <Row label={`Gift card${order.giftCardCode ? ` ••••${order.giftCardCode.slice(-4)}` : ""}`} value={`− ${money(order.giftCardAmount ?? 0)}`} />}
              {advance > 0 && <Row label="Advance paid" value={`− ${money(advance)}`} />}
              {order.paymentStatus !== "paid" && order.status !== "cancelled" && (
                <Row label={paidOnDelivery(order) ? "To pay on delivery" : "Amount due"} value={money(due)} strong />
              )}
            </dl>
          </section>

          {timeline.length > 0 && (
            <section className="card p-5 sm:p-6" aria-labelledby="timeline-h">
              <h2 id="timeline-h" className="font-display text-lg font-bold">
                Timeline
              </h2>
              <ol className="mt-3 space-y-2 text-sm">
                {timeline.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex justify-between gap-3">
                    <span>{ORDER_STATUS_LABEL[e.status] ?? e.status}</span>
                    <span className="text-muted tabular-nums">{formatDateTime(e.at, loc)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3 p-5" aria-label="Actions">
            <a href={`/account/orders/${order.orderNumber}/invoice`} className="btn btn-secondary w-full" download>
              <Download className="size-4" aria-hidden="true" /> Download invoice (PDF)
            </a>
            <BuyAgain lines={lines} unavailable={unavailable} />
          </section>

          <section className="card space-y-2 p-5 text-sm" aria-labelledby="delivery-h">
            <h2 id="delivery-h" className="flex items-center gap-2 font-display font-bold">
              <MapPin className="size-4 text-violet-400" aria-hidden="true" /> Delivery
            </h2>
            <p>{order.customer.name}</p>
            <p className="text-muted">{order.customer.phone}</p>
            <p className="text-muted">
              {order.customer.address}
              {order.customer.landmark ? ` (near ${order.customer.landmark})` : ""}, {cityLine(order.customer, loc.country)}
            </p>
            {order.trackingNumber ? (
              <p className="flex items-center gap-2 pt-1">
                <Truck className="size-4 text-violet-400" aria-hidden="true" />
                <span>
                  {courier ?? "Courier"} · <span className="font-mono">{order.trackingNumber}</span>
                  {trackUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-300">
                        Track parcel
                      </a>
                    </>
                  )}
                </span>
              </p>
            ) : (
              !stopped && <p className="text-xs text-subtle">The courier tracking number appears here once your parcel is shipped.</p>
            )}
          </section>

          <section className="card space-y-2 p-5 text-sm" aria-labelledby="payment-h">
            <h2 id="payment-h" className="flex items-center gap-2 font-display font-bold">
              <PackageCheck className="size-4 text-violet-400" aria-hidden="true" /> Payment
            </h2>
            <p>{paymentLabel(order.paymentMethod, order.paymentMethodLabel)}</p>
            <p className="text-muted">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
          </section>

          <section className="card space-y-2 p-5 text-sm" aria-label="Help">
            <a href={waLink(primaryPhone(site).wa, `Hi! I have a question about my order ${order.orderNumber}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">
              <MessageCircle className="size-4" aria-hidden="true" /> Ask about this order
            </a>
            {order.status === "delivered" && (
              <Link href={`/returns?order=${encodeURIComponent(order.orderNumber)}`} className="btn btn-ghost w-full">
                <RotateCcw className="size-4" aria-hidden="true" /> Return or warranty claim
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-semibold text-fg" : "text-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-bold text-fg")}>{value}</dd>
    </div>
  );
}
