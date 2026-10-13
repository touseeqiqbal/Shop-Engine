"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Heart, Info, LayoutDashboard, Loader2, MapPin, Package, Search } from "lucide-react";
import { findOrdersByPhoneAction, type FindOrdersState } from "@/app/(frontend)/(store)/account/actions";
import { ORDER_STATUS_LABEL } from "@/lib/order-display";
import type { OrderStatus } from "@/lib/types";
import { cn, formatDate, formatPKR } from "@/lib/utils";
import { Field, fieldAria } from "@/components/checkout/field";
import { formatPhoneInput } from "@/components/checkout/phone";
import { useState } from "react";

const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/stores", label: "Stores", icon: Package },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="scrollbar-none -mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === "/account" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  active ? "border-transparent bg-brand-gradient text-white" : "border-border-strong bg-surface text-muted hover:text-fg"
                )}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm", className)} role="note">
      <Info className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
      <p className="text-cyan-100/90">
        <strong className="text-cyan-100">Customer accounts are coming soon.</strong> Sign-in activates once the store database is connected. Meanwhile your
        wishlist and saved addresses are kept on this device, and you can find your orders with your phone number.
      </p>
    </div>
  );
}

export const STATUS_TONE: Record<OrderStatus, string> = {
  "awaiting-confirmation": "border-amber-500/40 bg-amber-500/10 text-amber-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  confirmed: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  dispatched: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  "out-for-delivery": "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  refused: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  returned: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export function OrderRows({ orders }: { orders: { orderNumber: string; createdAt: string; status: OrderStatus; total: number; itemsLabel?: string }[] }) {
  return (
    <ul className="divide-y divide-border">
      {orders.map((o) => (
        <li key={o.orderNumber} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-bold">{o.orderNumber}</p>
            <p className="text-xs text-muted">
              {formatDate(o.createdAt)}
              {o.itemsLabel ? ` · ${o.itemsLabel}` : ""}
            </p>
          </div>
          <span className={cn("chip", STATUS_TONE[o.status])}>{ORDER_STATUS_LABEL[o.status]}</span>
          <span className="w-28 text-right font-semibold tabular-nums">{formatPKR(o.total)}</span>
          <Link href={`/account/orders/${encodeURIComponent(o.orderNumber)}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FindOrdersByPhone() {
  const [state, action] = useActionState<FindOrdersState, FormData>(findOrdersByPhoneAction, { status: "idle" });
  const [phone, setPhone] = useState("");
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <Field id="find-phone" label="Mobile number used at checkout" required className="flex-1">
          <input
            {...fieldAria("find-phone")}
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="03XX-XXXXXXX"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            maxLength={12}
          />
        </Field>
        <div className="sm:pt-[1.625rem]">
          <FindButton />
        </div>
      </form>
      <div aria-live="polite">
        {state.status === "error" && (
          <p role="alert" className="flex items-center gap-2 text-sm text-rose-300">
            <AlertCircle className="size-4" aria-hidden="true" /> {state.message}
          </p>
        )}
        {state.status === "sent" && (
          <p role="status" className="flex items-start gap-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden="true" />
            {state.byMessage ? (
              <span>
                If this number has orders with us, we&apos;ve sent the order numbers by WhatsApp and to the email used on the order. Then use{" "}
                <Link href="/track-order" className="font-semibold text-violet-300 hover:text-violet-200">
                  Track order
                </Link>{" "}
                with the same phone number.
              </span>
            ) : (
              <span>
                For your privacy we don&apos;t show orders here. Your order number is in the message or email we sent when you ordered – use it on{" "}
                <Link href="/track-order" className="font-semibold text-violet-300 hover:text-violet-200">
                  Track order
                </Link>
                . Can&apos;t find it?{" "}
                <Link href="/contact" className="font-semibold text-violet-300 hover:text-violet-200">
                  Contact us
                </Link>{" "}
                from that phone number and we&apos;ll help.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function FindButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />} Find my orders
    </button>
  );
}
