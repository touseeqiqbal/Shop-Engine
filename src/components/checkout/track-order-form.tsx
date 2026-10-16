"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { m as motion } from "framer-motion";
import { AlertCircle, CheckCircle2, CircleDashed, ExternalLink, Loader2, PackageCheck, PackageX, Search, Truck, Undo2 } from "lucide-react";
import { trackOrder, type TrackState, type TrackedOrder } from "@/app/(frontend)/(store)/track-order/actions";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { useSiteInfo } from "@/components/providers/site-info";
import { useDateFormatter, useMoney, useStoreLocale } from "@/components/providers/locale";
import { deliveryEstimate } from "@/lib/cities";
import { ORDER_FLOW, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, paymentLabel } from "@/lib/order-display";
import { phonePlaceholder } from "@/lib/phone";
import { waLink } from "@/lib/site";
import { primaryPhone } from "@/lib/site-info";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CopyButton } from "./order-bits";
import { Field, fieldAria } from "./field";
import { formatPhoneInput } from "./phone";

export function TrackOrderForm({ initialOrder = "" }: { initialOrder?: string }) {
  const [state, action] = useActionState<TrackState, FormData>(trackOrder, { status: "idle" });
  const [order, setOrder] = useState(initialOrder.toUpperCase());
  const [phone, setPhone] = useState("");
  const { country } = useStoreLocale();
  const pk = country === "PK"; // other countries type the number with its +code
  const resultRef = useRef<HTMLDivElement>(null);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state.status === "found") resultRef.current?.focus({ preventScroll: false });
  }, [state]);

  return (
    <div className="space-y-6">
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-start sm:p-6" noValidate>
        <Field id="track-order" label="Order number" required error={errors.order}>
          <input
            {...fieldAria("track-order", errors.order)}
            name="order"
            placeholder="UTS-260512-482193"
            autoCapitalize="characters"
            autoComplete="off"
            value={order}
            onChange={(e) => setOrder(e.target.value.toUpperCase())}
            className={cn(fieldAria("track-order", errors.order).className, "font-mono uppercase tracking-wide")}
            required
          />
        </Field>
        <Field id="track-phone" label="Mobile number" required error={errors.phone}>
          <input
            {...fieldAria("track-phone", errors.phone)}
            name="phone"
            type="tel"
            inputMode={pk ? "numeric" : "tel"}
            autoComplete={pk ? "tel-national" : "tel"}
            placeholder={phonePlaceholder(country)}
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value, country))}
            maxLength={pk ? 12 : 20}
            required
          />
        </Field>
        <div className="sm:pt-[1.625rem]">
          <TrackButton />
        </div>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {state.status === "error" && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" /> {state.message}
          </p>
        )}
      </div>

      {state.status === "found" && (
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <TrackResult key={state.ts} order={state.order} />
        </div>
      )}
    </div>
  );
}

function TrackButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
      {pending ? "Searching…" : "Track order"}
    </button>
  );
}

const STEP_HINT: Record<OrderStatus, string> = {
  "awaiting-payment": "Waiting for your online payment",
  "awaiting-confirmation": "Waiting for you to confirm – check your WhatsApp / SMS",
  pending: "Order received – awaiting confirmation",
  confirmed: "Confirmed and being packed",
  dispatched: "Handed over to the courier",
  "out-for-delivery": "With the rider – arriving today",
  delivered: "Delivered – enjoy your purchase!",
  cancelled: "This order was cancelled",
  refused: "This parcel was refused and returned to us",
  returned: "This order was returned",
};

function lastAt(history: TrackedOrder["history"], status: OrderStatus) {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].status === status) return history[i];
  return null;
}

function TrackResult({ order }: { order: TrackedOrder }) {
  const site = useSiteInfo(); // the current store's own WhatsApp number
  const money = useMoney();
  const date = useDateFormatter(); // the store's time zone, not the shopper's device
  const terminal = order.status === "cancelled" || order.status === "returned";
  // Highest happy-path step reached (from history, so cancelled/returned orders still show their progress)
  const reached = Math.max(
    ORDER_FLOW.indexOf(order.status),
    ...order.history.map((h) => ORDER_FLOW.indexOf(h.status))
  );
  const steps: OrderStatus[] = terminal ? [...ORDER_FLOW.slice(0, Math.max(reached, 0) + 1), order.status] : ORDER_FLOW;
  const currentIndex = terminal ? steps.length - 1 : reached;
  const eta = deliveryEstimate(order.city);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <section className="card p-5 sm:p-6" aria-labelledby="track-status-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-subtle">Order</p>
            <p className="font-mono text-lg font-bold">{order.orderNumber}</p>
            <p className="text-xs text-muted">Placed {date(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <span
            className={cn(
              "chip",
              terminal ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : order.status === "delivered" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-violet-500/40 bg-violet-500/10 text-violet-200"
            )}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
        <h2 id="track-status-heading" className="mt-5 font-display text-lg font-bold">
          {STEP_HINT[order.status]}
        </h2>
        {!terminal && order.status !== "delivered" && <p className="mt-1 text-sm text-muted">Estimated delivery to {order.city}: {eta.label}</p>}

        <ol className="relative mt-6 space-y-0" aria-label="Order progress">
          {steps.map((s, i) => {
            const done = i < currentIndex || (i === currentIndex && (s === "delivered" || terminal));
            const current = i === currentIndex;
            const ev = lastAt(order.history, s);
            const bad = s === "cancelled" || s === "returned";
            const Icon = bad ? (s === "cancelled" ? PackageX : Undo2) : done || current ? (s === "delivered" ? PackageCheck : CheckCircle2) : CircleDashed;
            return (
              <motion.li
                key={s}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.12 }}
                className="relative flex gap-4 pb-6 last:pb-0"
                aria-current={current ? "step" : undefined}
              >
                {i < steps.length - 1 && (
                  <span className="absolute left-[1.0625rem] top-9 h-[calc(100%-2.25rem)] w-0.5 overflow-hidden rounded bg-border-strong" aria-hidden="true">
                    <motion.span
                      className="block w-full bg-brand-gradient"
                      initial={{ height: 0 }}
                      animate={{ height: i < currentIndex ? "100%" : 0 }}
                      transition={{ delay: 0.25 + i * 0.12, duration: 0.4 }}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "relative grid size-9 shrink-0 place-items-center rounded-full border-2",
                    bad
                      ? "border-rose-500/60 bg-rose-500/15 text-rose-300"
                      : done || current
                        ? "border-transparent bg-brand-gradient text-white"
                        : "border-border-strong bg-surface text-subtle"
                  )}
                >
                  {current && !done && !bad && <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/40" aria-hidden="true" />}
                  <Icon className="relative size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-1.5">
                  <p className={cn("text-sm font-semibold", !(done || current) && "text-muted")}>
                    {s === "pending" ? "Order placed" : ORDER_STATUS_LABEL[s]}
                    <span className="sr-only">{done ? " – completed" : current ? " – current step" : " – upcoming"}</span>
                  </p>
                  {ev ? (
                    <p className="text-xs text-muted">
                      {date(ev.at, { dateStyle: "medium", timeStyle: "short" })}
                      
                    </p>
                  ) : (
                    !(done || current) && <p className="text-xs text-subtle">Not yet</p>
                  )}
                  {s === "dispatched" && order.trackingNumber && (done || current) && (
                    <p className="mt-1 text-xs text-muted">
                      {order.courierName} · {order.trackingNumber}
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </section>

      <div className="space-y-5">
        <section className="card space-y-3 p-5" aria-labelledby="track-courier">
          <h2 id="track-courier" className="flex items-center gap-2 font-display font-bold">
            <Truck className="size-4 text-violet-300" aria-hidden="true" /> Courier
          </h2>
          {order.trackingNumber ? (
            <>
              <p className="text-sm">
                <span className="text-muted">Courier:</span> <strong>{order.courierName ?? "Courier"}</strong>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{order.trackingNumber}</span>
                <CopyButton value={order.trackingNumber} label="Copy" />
              </div>
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm w-full">
                  Track on {order.courierName} <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Your courier and tracking number will appear here once the order is dispatched.</p>
          )}
        </section>

        <section className="card p-5" aria-labelledby="track-items">
          <h2 id="track-items" className="font-display font-bold">
            Items
          </h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                  {i.image && <Image src={i.image} alt={i.name} fill sizes="48px" className="object-contain p-1" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={i.url} className="line-clamp-1 font-medium hover:underline">
                    {i.name}
                  </Link>
                  <p className="text-xs text-muted">
                    Qty {i.qty}
                    {i.upgrades.length ? ` · + ${i.upgrades.join(", ")}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted">
              {paymentLabel(order.paymentMethod, order.paymentMethodLabel)} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}
            </span>
            <span className="font-display text-lg font-bold tabular-nums">{money(order.total)}</span>
          </div>
        </section>

        <a
          href={waLink(primaryPhone(site).wa, `Hi, I'd like an update on my order ${order.orderNumber}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-whatsapp w-full"
        >
          <WhatsAppIcon className="size-5" /> Ask about this order
        </a>
      </div>
    </motion.div>
  );
}
