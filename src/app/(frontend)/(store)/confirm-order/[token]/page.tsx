import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, PackageX } from "lucide-react";
import { findOrderByConfirmToken } from "@/lib/cms/confirm";
import { formatPKR } from "@/lib/utils";
import { amountToCollect } from "@/lib/order-money";
import { cancelByLink, confirmByLink } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Confirm your order", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> };

const ERRORS: Record<string, string> = {
  expired: "The time to confirm has passed, so this order was cancelled.",
  busy: "Too many tries – please wait a few minutes.",
  "not-found": "We couldn't find this order.",
  "not-waiting": "This order doesn't need confirming any more.",
};

/** Opened from the link in WhatsApp / SMS / email: one tap to confirm (or cancel) a cash-on-delivery order. */
export default async function ConfirmOrderPage({ params, searchParams }: Props) {
  const [{ token }, { e }] = await Promise.all([params, searchParams]);
  const order = await findOrderByConfirmToken(token).catch(() => null);

  if (!order) {
    return (
      <Shell icon={<PackageX className="size-12 text-rose-300" aria-hidden="true" />} title="Link not valid">
        <p className="text-muted">This confirmation link is wrong or too old. If you placed an order, please WhatsApp us with your order number.</p>
      </Shell>
    );
  }

  const first = order.customer.name.split(" ")[0];
  // an uploaded advance only counts once the shop has checked it (same rule as the rider's slip)
  const due = amountToCollect(order);
  const advancePending = order.paymentStatus === "awaiting-verification" && (order.advancePaid ?? 0) > 0;
  const deadline = order.confirmation?.expiresAt
    ? new Date(order.confirmation.expiresAt).toLocaleString("en-PK", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" })
    : "";

  if (order.status === "awaiting-confirmation" && !e) {
    return (
      <Shell icon={<CircleAlert className="size-12 text-amber-300" aria-hidden="true" />} title={`Hi ${first}, please confirm your order`}>
        <p className="text-muted">
          Order <strong className="font-mono text-fg">{order.orderNumber}</strong> · {order.items.reduce((n, i) => n + i.qty, 0)} item(s) · delivery to {order.customer.city}
        </p>
        <ul className="mt-4 space-y-1 text-left text-sm">
          {order.items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span className="line-clamp-1">
                {i.name} × {i.qty}
              </span>
              <span className="tabular-nums">{formatPKR(i.unitPrice * i.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          Pay <strong className="text-fg">{formatPKR(due)}</strong> in cash when the rider arrives.
          {advancePending ? ` Once we've checked your advance of ${formatPKR(order.advancePaid ?? 0)}, it is taken off this amount.` : ""}
        </p>
        {deadline && <p className="mt-3 text-xs text-subtle">Not confirmed by {deadline} = cancelled automatically.</p>}
        <form className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button formAction={confirmByLink.bind(null, token)} className="btn btn-primary btn-lg">
            Yes, confirm my order
          </button>
          <button formAction={cancelByLink.bind(null, token)} className="btn btn-secondary btn-lg">
            I didn&apos;t order this – cancel
          </button>
        </form>
      </Shell>
    );
  }

  if (order.status === "cancelled" || order.status === "refused") {
    return (
      <Shell icon={<PackageX className="size-12 text-rose-300" aria-hidden="true" />} title="Order cancelled">
        <p className="text-muted">{e && ERRORS[e] ? ERRORS[e] : `Order ${order.orderNumber} is cancelled. Nothing will be delivered and you won't be charged.`}</p>
        <Link href="/" className="btn btn-primary mt-6">
          Continue shopping
        </Link>
      </Shell>
    );
  }

  return (
    <Shell icon={<CheckCircle2 className="size-12 text-emerald-300" aria-hidden="true" />} title={e && ERRORS[e] ? "Order" : `Thank you, ${first}!`}>
      <p className="text-muted">{e && ERRORS[e] ? ERRORS[e] : `Order ${order.orderNumber} is confirmed. We'll pack it and send you the tracking number.`}</p>
      <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="btn btn-primary mt-6">
        Track my order
      </Link>
    </Shell>
  );
}

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-12 sm:py-16">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
