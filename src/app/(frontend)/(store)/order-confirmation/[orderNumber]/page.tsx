import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarClock, MapPin, PackageSearch, Truck, Wallet } from "lucide-react";
import { CopyButton, SuccessBadge } from "@/components/checkout/order-bits";
import { ConfirmCodeForm } from "@/components/checkout/confirm-code-form";
import { CreateAccountCard } from "@/components/checkout/create-account-card";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { getSessionUser } from "@/lib/auth";
import { deliveryEstimate } from "@/lib/cities";
import { LAST_ORDER_COOKIE, cookieMatchesOrder } from "@/lib/order-cookie";
import { ORDER_NUMBER_RE } from "@/lib/order-number";
import { cityLine, PAYMENT_STATUS_LABEL, paymentAccountLines, paymentLabel } from "@/lib/order-display";
import { paidOnDelivery } from "@/lib/order-money";
import { findCheckoutMethod } from "@/lib/payments/methods";
import { integrationInfo, isPaymentIntegration, PAYMENT_PAGE_MINUTES } from "@/lib/integrations/catalog";
import { getStoreSettings } from "@/lib/repo/catalog";
import { getOrderByNumber } from "@/lib/repo/orders";
import { getSiteInfo } from "@/lib/repo/site-content";
import { pageMetadata } from "@/lib/seo";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import { moneyFormatter } from "@/lib/money";
import { getStoreLocale } from "@/lib/store-locale";
import { formatDate, formatDateTime } from "@/lib/time";
import { payNow } from "./pay-action";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ payment?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ orderNumber }, locale] = await Promise.all([params, getStoreLocale()]);
  return pageMetadata({
    title: "Order confirmed",
    description: "Thank you for your order.",
    path: `/order-confirmation/${encodeURIComponent(orderNumber)}`,
    noindex: true,
    locale,
  });
}

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const [{ orderNumber: raw }, { payment }] = await Promise.all([params, searchParams]);
  const orderNumber = decodeURIComponent(raw).trim().toUpperCase();
  const [order, jar, user] = await Promise.all([
    ORDER_NUMBER_RE.test(orderNumber) ? getOrderByNumber(orderNumber) : Promise.resolve(null),
    cookies(),
    getSessionUser().catch(() => null),
  ]);
  const allowed = !!order && (cookieMatchesOrder(jar.get(LAST_ORDER_COOKIE)?.value, order.orderNumber) || (!!user && !!order.userId && order.userId === user.id));

  if (!order || !allowed) {
    return (
      <div className="container-x py-12 sm:py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <PackageSearch className="mx-auto size-12 text-violet-300" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-bold">Order {orderNumber}</h1>
          <p className="mt-2 text-sm text-muted">
            For your privacy, full order details are only shown on the device that placed the order. Track your order with your order number and phone
            number instead.
          </p>
          <Link href={`/track-order?order=${encodeURIComponent(orderNumber)}`} className="btn btn-primary mt-6">
            Track my order
          </Link>
        </div>
      </div>
    );
  }

  const [settings, site, loc] = await Promise.all([getStoreSettings(), getSiteInfo(), getStoreLocale()]);
  // amounts and times in the store's currency and time zone
  const money = moneyFormatter(loc);
  const eta = deliveryEstimate(order.customer.city, settings, order.customer.postalCode ?? "", order.customer.country);
  const accountLines = paymentAccountLines(order.paymentMethod, settings);
  // the store's own steps for its own methods ("use your order number as the reference")
  const instructions = findCheckoutMethod(order.paymentMethod, settings)?.instructions;
  const awaitingCode = order.status === "awaiting-confirmation" && Boolean(order.confirmation);
  // paid on a provider's page: the platform card provider, or one the store connected (PayPal, JazzCash online …)
  const online = order.paymentMethod === "card" || isPaymentIntegration(order.paymentMethod);
  const providerName = order.paymentMethod === "card" ? null : (integrationInfo(order.paymentMethod)?.payment?.label ?? integrationInfo(order.paymentMethod)?.name ?? null);
  const what = providerName ? `${providerName} payment` : "card payment";
  const waText = awaitingCode
    ? `Hi, I have a question about my order ${order.orderNumber} (${money(order.total)}).`
    : `Hi, I just placed order ${order.orderNumber}, total ${money(order.total)}, please confirm.`;

  return (
    <div className="container-x pb-14 pt-6 sm:pt-10">
      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] border border-border bg-bg-elevated px-5 py-10 text-center sm:px-10">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <SuccessBadge />
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
            Thank you, <span className="gradient-text">{order.customer.name.split(" ")[0]}</span>!
          </h1>
          {online && order.status === "awaiting-payment" ? (
            // the order is only paid when the payment provider confirms it (never from this page's address)
            <div className="mx-auto mt-3 max-w-md space-y-3 text-muted">
              {payment === "done" ? (
                <p>We&apos;re confirming your {what} {providerName ? `with ${integrationInfo(order.paymentMethod)?.name}` : "with the bank"} – this usually takes a few seconds. Refresh this page in a moment.</p>
              ) : (
                <p>
                  {payment === "cancelled" ? `The ${what} wasn't completed. ` : payment === "expired" ? "The payment page has expired. " : ""}
                  Your order is reserved for {providerName ? PAYMENT_PAGE_MINUTES : 30} minutes while you pay.
                </p>
              )}
              <form action={payNow.bind(null, order.orderNumber)}>
                <button className="btn btn-primary btn-lg">
                  Pay {money(order.total)} {providerName ? `with ${integrationInfo(order.paymentMethod)?.name}` : "by card"}
                </button>
              </form>
            </div>
          ) : online && order.status === "cancelled" && order.paymentStatus !== "paid" ? (
            <p className="mx-auto mt-2 max-w-md text-muted">The {what} wasn&apos;t completed, so this order was cancelled and nothing was charged. You can place it again from your cart.</p>
          ) : order.status === "awaiting-confirmation" && order.confirmation ? (
            <ConfirmCodeForm
              orderNumber={order.orderNumber}
              phone={order.customer.phone}
              deadline={formatDate(order.confirmation.expiresAt, loc, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            />
          ) : (
            <p className="mx-auto mt-2 max-w-md text-muted">
              {order.confirmation?.confirmedAt ? (
                <>Your order is confirmed – we&apos;ll pack it and send you the tracking number.</>
              ) : (
                <>
                  Your order has been placed. Our team will call or WhatsApp you on <strong className="text-fg">{order.customer.phone}</strong> to confirm it.
                </>
              )}
            </p>
          )}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border-strong bg-surface px-4 py-3">
            <span className="text-sm text-muted">Order number</span>
            <span className="font-mono text-lg font-bold tracking-wide">{order.orderNumber}</span>
            <CopyButton value={order.orderNumber} />
          </div>
          <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
            <a href={waLink(primaryPhone(site).wa, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
              <WhatsAppIcon className="size-5" /> {awaitingCode ? "Questions? WhatsApp us" : "Confirm on WhatsApp"}
            </a>
            <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="btn btn-secondary btn-lg">
              <Truck className="size-4" aria-hidden="true" /> Track order
            </Link>
            <a href={`/account/orders/${encodeURIComponent(order.orderNumber)}/invoice`} className="btn btn-ghost btn-lg" download>
              Invoice (PDF)
            </a>
          </div>
        </div>
      </section>

      {/* like Shopify: the order already made a customer record – one click turns it into an account */}
      {!user && order.customer.email && <CreateAccountCard orderNumber={order.orderNumber} email={order.customer.email} />}

      <div className="mx-auto mt-6 grid max-w-3xl gap-5 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="oc-items">
          <h2 id="oc-items" className="font-display text-lg font-bold">
            Items ordered
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.productId + i.upgrades.map((u) => u.id).join()} className="flex gap-3 py-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                  {i.image && <Image src={i.image} alt={i.name} fill sizes="64px" className="object-contain p-1" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={i.url} className="line-clamp-2 text-sm font-medium hover:underline">
                    {i.name}
                  </Link>
                  {i.upgrades.length > 0 && <p className="text-xs text-violet-300">+ {i.upgrades.map((u) => u.label).join(", ")}</p>}
                  <p className="text-xs text-muted">
                    Qty {i.qty} × {money(i.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{money(i.unitPrice * i.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-2 border-t border-border pt-4 text-sm">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${money(order.discount)}`} accent />}
            <Row label="Delivery" value={order.deliveryCharge ? money(order.deliveryCharge) : "FREE"} />
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{money(order.total)}</dd>
            </div>
            {order.advancePaid ? (
              <>
                <Row label={order.paymentStatus === "partial" ? "Advance paid" : "Advance (being checked)"} value={money(order.advancePaid)} accent />
                <Row label="Due on delivery" value={money(Math.max(0, order.total - order.advancePaid))} />
              </>
            ) : null}
          </dl>
        </section>

        <div className="space-y-5">
          <section className="card space-y-3 p-5" aria-labelledby="oc-delivery">
            <h2 id="oc-delivery" className="flex items-center gap-2 font-display font-bold">
              <MapPin className="size-4 text-violet-300" aria-hidden="true" /> Delivery
            </h2>
            <p className="text-sm text-muted">
              <span className="font-medium text-fg">{order.customer.name}</span>
              <br />
              {order.customer.address}
              {order.customer.landmark && (
                <>
                  <br />
                  Near {order.customer.landmark}
                </>
              )}
              <br />
              {cityLine(order.customer, loc.country)}
            </p>
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" /> Estimated: {eta.label}
            </p>
          </section>

          <section className="card space-y-3 p-5" aria-labelledby="oc-payment">
            <h2 id="oc-payment" className="flex items-center gap-2 font-display font-bold">
              <Wallet className="size-4 text-violet-300" aria-hidden="true" /> Payment
            </h2>
            <p className="text-sm">
              {paymentLabel(order.paymentMethod, order.paymentMethodLabel)} · <span className="text-muted">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span>
            </p>
            {paidOnDelivery(order) ? (
              <p className="text-sm text-muted">
                Please keep <strong className="text-fg">{money(Math.max(0, order.total - (order.advancePaid ?? 0)))}</strong> ready {order.paymentMethod === "cod" ? "in cash when the rider arrives" : "when your order arrives"}
                {order.advancePaid && order.paymentStatus !== "partial" ? " (once we've confirmed your advance)" : ""}.
              </p>
            ) : accountLines.length === 0 ? null : (
              <>
                <p className="text-sm text-muted">
                  {order.paymentScreenshotUrl
                    ? "We received your payment screenshot and will verify it shortly."
                    : `Please send ${money(order.total)} to the account below and share the screenshot on WhatsApp.`}
                </p>
                <dl className="space-y-1 rounded-xl bg-surface-strong p-3 text-xs">
                  {accountLines.map((l) => (
                    <div key={l.label} className="flex flex-wrap justify-between gap-x-2">
                      <dt className="text-muted">{l.label}</dt>
                      <dd className="select-all font-mono font-semibold">{l.value}</dd>
                    </div>
                  ))}
                </dl>
                {!order.paymentScreenshotUrl && instructions && <p className="whitespace-pre-line text-xs text-muted">{instructions}</p>}
              </>
            )}
            <p className="text-xs text-subtle">Placed {formatDateTime(order.createdAt, loc)}</p>
          </section>
        </div>
      </div>

      <p className="mt-8 text-center">
        <Link href="/shop" className="text-sm font-semibold text-muted hover:text-fg">
          ← Continue shopping
        </Link>
      </p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-emerald-400" : ""}`}>
      <dt className={accent ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
