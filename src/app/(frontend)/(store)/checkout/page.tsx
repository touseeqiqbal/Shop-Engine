import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { CheckoutForm, type CheckoutPrefill } from "@/components/checkout/checkout-form";
import { ConfirmEmailNotice } from "@/components/account/auth-forms";
import { emailRequiredAtCheckout, getSessionUser, getUserProfile, mustConfirmEmailToOrder } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/config";
import { getStoreSettings } from "@/lib/repo/catalog";
import { pageMetadata } from "@/lib/seo";
import { getSiteInfo } from "@/lib/repo/site-content";
import type { SavedAddress } from "@/lib/types";
import { getStoreLocale } from "@/lib/store-locale";
import { countryName } from "@/lib/locale";
import { checkoutMethods } from "@/lib/payments/methods";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [{ name }, settings, loc] = await Promise.all([getSiteInfo(), getStoreSettings(), getStoreLocale()]); // the current store's own name
  // the ways this store takes payment, e.g. "Cash on Delivery, JazzCash, EasyPaisa or Bank Transfer"
  const ways = checkoutMethods(settings).map((m) => m.label);
  const pay = ways.length > 1 ? `${ways.slice(0, -1).join(", ")} or ${ways[ways.length - 1]}` : (ways[0] ?? "");
  return pageMetadata({
    locale: loc,
    title: `Secure Checkout | ${name}`,
    description: `Complete your order${pay ? ` – ${pay}` : ""}. Delivery ${loc.country === "PK" ? "all over Pakistan" : `across ${countryName(loc.country)}`}.`,
    path: "/checkout",
    noindex: true,
  });
}

export default async function CheckoutPage() {
  const [settings, loc] = await Promise.all([getStoreSettings(), getStoreLocale()]);
  let prefill: CheckoutPrefill | null = null;
  let addresses: SavedAddress[] = [];
  let accountMode: "remote" | "local" | "none" = isDatabaseConfigured ? "none" : "local";
  let confirmFirst = false;

  const user = await getSessionUser().catch(() => null);
  if (user && user.role === "customer" && isDatabaseConfigured) {
    accountMode = "remote";
    const profile = await getUserProfile(user.id).catch(() => null);
    prefill = { name: profile?.name ?? user.name ?? "", email: user.email, phone: profile?.phone ?? "" };
    addresses = profile?.addresses ?? [];
    confirmFirst = await mustConfirmEmailToOrder(user).catch(() => false);
  }

  return (
    <div className="container-x pb-12 pt-4 sm:pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            <span className="gradient-text">Checkout</span>
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Lock className="size-3.5 text-emerald-400" aria-hidden="true" /> Secure checkout · Delivery {loc.country === "PK" ? "all over Pakistan" : `across ${countryName(loc.country)}`}
          </p>
        </div>
        {!user && isDatabaseConfigured && (
          <p className="text-sm text-muted">
            Have an account?{" "}
            <Link href="/account/login?next=/checkout" className="font-semibold text-violet-300 hover:text-violet-200">
              Sign in
            </Link>{" "}
            for saved addresses
          </p>
        )}
      </div>
      {confirmFirst && user ? (
        <ConfirmEmailNotice email={user.email} text="Confirm your email to check out with your account – open the link we sent you, then come back to this page. Your cart is kept." />
      ) : (
        <CheckoutForm settings={settings} prefill={prefill} savedAddresses={addresses} accountMode={accountMode} emailRequired={emailRequiredAtCheckout()} />
      )}
    </div>
  );
}
