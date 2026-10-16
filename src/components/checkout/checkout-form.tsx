"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import {
  AlertCircle,
  Banknote,
  BookmarkCheck,
  ChevronDown,
  CreditCard,
  ImageUp,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { placeOrder, type CheckoutField, type PlaceOrderState } from "@/app/(frontend)/(store)/checkout/actions";
import { trackEvent } from "@/components/analytics";
import { useHydrated } from "@/hooks/use-hydrated";
import { readLocalAddresses, writeLocalAddresses } from "@/lib/addresses";
import { deliveryEstimate, freeDeliveryAbove, shipToCountries } from "@/lib/cities";
import { orderTotals } from "@/lib/order-totals";
import { checkoutMethods, type CheckoutMethod, type PaymentIcon } from "@/lib/payments/methods";
import { countryInText, countryName, deliveryArea } from "@/lib/locale";
import { normalizePhone, phonePlaceholder } from "@/lib/phone";
import type { PaymentMethod, SavedAddress, StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { Skeleton } from "@/components/ui/skeleton";
import { CityCombobox } from "./city-combobox";
import { CouponBox } from "./coupon-box";
import { Field, fieldAria } from "./field";
import { formatPhoneInput } from "./phone";
import { toRequestLines, useCartCoupon, useCartSync } from "./use-coupon";
import { Turnstile } from "@/components/ui/turnstile";
import { saveDraft } from "@/app/(frontend)/(store)/checkout/draft-actions";
import { honeypotProps } from "@/lib/honeypot";

const MAX_FILE = 5 * 1024 * 1024;
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FIELD_ORDER: CheckoutField[] = ["name", "phone", "email", "city", "region", "postalCode", "address", "landmark", "notes", "paymentMethod", "screenshot", "paymentReference"];
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/-]{3,59}$/;
const METHOD_ICON: Record<PaymentIcon, React.ComponentType<{ className?: string }>> = { cash: Banknote, wallet: Smartphone, bank: Landmark, card: CreditCard, other: Wallet };

type Errors = Partial<Record<CheckoutField, string>>;

export interface CheckoutPrefill {
  name?: string;
  email?: string;
  phone?: string;
}

export function CheckoutForm({
  settings,
  prefill,
  savedAddresses: remoteAddresses,
  accountMode,
  emailRequired = false,
}: {
  settings: StoreSettings;
  prefill: CheckoutPrefill | null;
  savedAddresses: SavedAddress[];
  /** "remote" = signed-in customer (addresses saved to profile), "local" = demo mode (localStorage), "none" = guest */
  accountMode: "remote" | "local" | "none";
  /** Email is required (receipt and cash-on-delivery confirmation are emailed) */
  emailRequired?: boolean;
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const coupon = useCartCoupon(hydrated);
  const syncNotice = useCartSync(hydrated);
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, { ok: false });
  // One id per checkout attempt: if the same submit reaches the server twice (double tap, retry after a dropped
  // connection) the server returns the order it already placed instead of creating a second one.
  const attemptId = useRef<string>("");
  const submitting = useRef(false);
  // total the customer has seen and accepted after the server reported a change
  const acceptedTotal = useRef<number | null>(null);
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  // the store's country: Pakistan picks its city from a list; elsewhere city, state and postcode are typed
  const loc = useStoreLocale();
  const money = useMoney();
  const pk = loc.country === "PK";
  // where the parcel goes: the store's country, or one it also delivers to (Settings → Delivery → Also deliver to)
  const countries = useMemo(() => shipToCountries(settings), [settings]);
  const [shipTo, setShipTo] = useState(loc.country);
  const pkAddr = shipTo === "PK";

  const [f, setF] = useState({
    name: prefill?.name ?? "",
    phone: prefill?.phone ? formatPhoneInput(prefill.phone, loc.country) : "",
    email: prefill?.email ?? "",
    city: "",
    region: "",
    postalCode: "",
    address: "",
    landmark: "",
    notes: "",
  });
  // Started checkout with a phone or email → remember the cart for a reminder if they leave (abandoned cart)
  const draftKey = `${f.name}|${normalizePhone(f.phone, shipTo) ?? ""}|${f.email.trim()}|${lines.map((l) => `${l.productId}x${l.qty}`).join(",")}`;
  useEffect(() => {
    if (!lines.length || (!normalizePhone(f.phone, shipTo) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()))) return;
    const t = setTimeout(() => {
      void saveDraft({
        name: f.name,
        phone: f.phone,
        email: f.email,
        // ids and quantities only – the server fills in names and prices from the catalogue
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty, upgradeIds: l.upgrades.map((u) => u.id) })),
      }).catch(() => undefined);
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  // what this store offers (lib/payments/methods.ts) – first one that isn't paid on another site (COD unless switched off)
  const methods = useMemo(() => checkoutMethods(settings), [settings]);
  const [method, setMethod] = useState<PaymentMethod>(() => (methods.find((m) => m.kind !== "gateway") ?? methods[0])?.id ?? "cod");
  const current: CheckoutMethod | null = methods.find((m) => m.id === method) ?? null;
  const emailNeeded = emailRequired;
  const [file, setFile] = useState<File | null>(null);
  // the transaction id from the wallet / bank transfer receipt (one receipt pays for one order)
  const [reference, setReference] = useState("");
  // set when the server says this customer / city must pay an advance for cash on delivery
  const [advanceRequired, setAdvanceRequired] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formMessage, setFormMessage] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saveAddress, setSaveAddress] = useState(accountMode !== "none");
  const [localAddresses, setLocalAddresses] = useState<SavedAddress[]>([]);
  const [placed, setPlaced] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const began = useRef(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = k === "phone" ? formatPhoneInput(e.target.value, shipTo) : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k as CheckoutField]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  // localStorage addresses (demo mode)
  useEffect(() => {
    if (accountMode === "local") setLocalAddresses(readLocalAddresses());
  }, [accountMode]);
  const addresses = accountMode === "local" ? localAddresses : remoteAddresses;

  // analytics: begin_checkout once the cart is known
  useEffect(() => {
    if (!hydrated || began.current || lines.length === 0) return;
    began.current = true;
    trackEvent("begin_checkout", { currency: loc.currency, value: cartSubtotal(lines), items: lines.map((l) => ({ item_id: l.productId, item_name: l.name, price: l.unitPrice, quantity: l.qty })) });
  }, [hydrated, lines, loc.currency]);

  // screenshot preview URL lifecycle
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const focusFirst = (errs: Errors) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    const el = document.getElementById(first === "paymentMethod" ? fid(`pm-${methods[0]?.id ?? "cod"}`) : fid(first));
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // server response
  useEffect(() => {
    if (!state.ts) return;
    submitting.current = false;
    if (state.ok) {
      setPlaced(true);
      if (accountMode === "local" && saveAddress) {
        const list = readLocalAddresses();
        const dup = list.some((a) => a.address.trim().toLowerCase() === f.address.trim().toLowerCase() && a.city === f.city);
        if (!dup)
          writeLocalAddresses([
            { id: crypto.randomUUID(), label: list.length ? `Address ${list.length + 1}` : "Home", name: f.name, phone: f.phone, city: f.city, address: f.address, landmark: f.landmark || undefined, region: f.region || undefined, postalCode: f.postalCode || undefined, ...(shipTo !== loc.country ? { country: shipTo } : {}) },
            ...list,
          ]);
      }
      trackEvent("purchase", { transaction_id: state.orderNumber, value: state.total, currency: loc.currency, items: state.items });
      clearCart();
      // card: on to the payment provider's secure page (the order is marked paid only when the provider confirms it)
      if (state.paymentUrl) window.location.assign(state.paymentUrl);
      else router.replace(`/order-confirmation/${encodeURIComponent(state.orderNumber)}`);
    } else {
      if (state.requireAdvance) setAdvanceRequired(true);
      if (state.newTotal) acceptedTotal.current = state.newTotal;
      if (state.couponError) coupon.remove();
      setErrors(state.fieldErrors ?? {});
      setFormMessage(state.message ?? "");
      focusFirst(state.fieldErrors ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const subtotal = cartSubtotal(lines);
  // the same arithmetic the server uses (lib/order-totals.ts) – the server's total is the one that counts
  const totals = orderTotals({ subtotal, discount: coupon.discount, city: f.city, postalCode: f.postalCode, country: shipTo, method, settings, freeShipping: coupon.freeShipping });
  const { discount, delivery, fee, total } = totals;
  const eta = f.city ? deliveryEstimate(f.city, settings, f.postalCode, shipTo) : null;
  const codMax = settings.payments?.cod.maxOrder ?? null;
  const onDelivery = current?.due === "on-delivery";
  const advanceEligible = onDelivery && settings.advanceAmount > 0 && (total >= settings.advanceThreshold || advanceRequired);
  const needsProof = Boolean(current?.proof);
  const accountLines = current?.account ?? [];
  // where an advance for cash on delivery can be sent: every method with a receipt
  const advanceTargets = methods
    .filter((m) => m.proof)
    .map((m) =>
      m.id === "jazzcash" || m.id === "easypaisa"
        ? `${m.label} (${settings[m.id].number})`
        : m.id === "bank"
          ? `bank (${settings.bank.bankName} · ${settings.bank.accountNumber})`
          : `${m.label}${m.account.length ? ` (${m.account.map((a) => a.value).join(" · ")})` : ""}`,
    );

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!picked) return;
    if (!FILE_TYPES.includes(picked.type)) return setErrors((er) => ({ ...er, screenshot: "Only JPG, PNG or WebP images are allowed" }));
    if (picked.size > MAX_FILE) return setErrors((er) => ({ ...er, screenshot: "Image must be 5 MB or smaller" }));
    setErrors((er) => ({ ...er, screenshot: undefined }));
    setFile(picked);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (f.name.trim().length < 3) e.name = "Please enter your full name";
    if (!normalizePhone(f.phone, shipTo)) e.phone = pkAddr ? "Enter a valid mobile number, e.g. 0300-1234567" : `Enter a valid phone number, e.g. ${phonePlaceholder(shipTo)}`;
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
    else if (emailNeeded && !f.email.trim()) e.email = "Enter your email address";
    if (pkAddr ? !f.city : f.city.trim().length < 2) e.city = pkAddr ? "Please choose your city from the list" : "Please enter your city";
    if (f.postalCode.trim() && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(f.postalCode.trim())) e.postalCode = "Enter a valid postcode";
    if (f.address.trim().length < (pkAddr ? 10 : 5)) e.address = "Please enter your complete address (house, street, area)";
    if (!current) e.paymentMethod = "Please choose a payment method";
    else if (method === "cod" && codMax && total > codMax) e.paymentMethod = `Cash on Delivery is available for orders up to ${money(codMax)} – please pay online`;
    if (needsProof && !file) e.screenshot = "Upload a screenshot of your payment (JPG, PNG or WebP)";
    if (needsProof && !REFERENCE.test(reference.trim())) e.paymentReference = "Enter the transaction ID from your payment receipt";
    if (onDelivery && advanceRequired && !file) e.screenshot = "Upload the screenshot of your advance payment";
    return e;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || submitting.current) return;
    if (coupon.status === "checking") {
      setFormMessage("Checking your coupon – one moment, then place the order.");
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      setFormMessage(`Please fix ${Object.keys(errs).length === 1 ? "the highlighted field" : `${Object.keys(errs).length} highlighted fields`}.`);
      focusFirst(errs);
      return;
    }
    setErrors({});
    setFormMessage("");
    const fd = new FormData(e.currentTarget);
    fd.set("items", JSON.stringify(toRequestLines(lines)));
    fd.set("couponCode", coupon.code && coupon.status !== "error" ? coupon.code : "");
    fd.set("paymentMethod", method);
    fd.set("country", shipTo);
    if (!attemptId.current) attemptId.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    fd.set("attemptId", attemptId.current);
    fd.set("expectedTotal", String(acceptedTotal.current ?? total));
    submitting.current = true;
    fd.delete("screenshot");
    if (file && (needsProof || advanceEligible)) fd.set("screenshot", file);
    fd.set("paymentReference", needsProof ? reference.trim() : "");
    startTransition(() => formAction(fd));
  };

  if (!hydrated) return <CheckoutSkeleton />;

  if (lines.length === 0) {
    return placed ? (
      <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
        <Loader2 className="size-8 animate-spin text-violet-400" aria-hidden="true" />
        <p className="font-semibold">Order placed! Taking you to your confirmation…</p>
      </div>
    ) : (
      <div className="card mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-surface-strong">
          <ShoppingBag className="size-9 text-muted" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="text-sm text-muted">Add a laptop or accessory to your cart to check out.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/shop" className="btn btn-primary">
            Browse products
          </Link>
          <Link href="/track-order" className="btn btn-secondary">
            Track an order
          </Link>
        </div>
      </div>
    );
  }

  const summary = (
    <OrderSummary
      settings={settings}
      coupon={coupon}
      subtotal={subtotal}
      discount={discount}
      delivery={delivery}
      codFee={fee}
      tax={totals.tax}
      taxAdded={totals.taxAdded}
      total={total}
      eta={eta?.label ?? null}
      city={f.city}
      postalCode={f.postalCode}
      country={shipTo}
    />
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start xl:gap-10">
      {/* Mobile collapsible summary */}
      <div className="card overflow-hidden lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          aria-expanded={summaryOpen}
          aria-controls={fid("m-summary")}
          onClick={() => setSummaryOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4 text-violet-300" aria-hidden="true" />
            {summaryOpen ? "Hide" : "Show"} order summary ({cartCount(lines)})
            <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tabular-nums">{money(total)}</span>
        </button>
        <AnimatePresence initial={false}>
          {summaryOpen && (
            <motion.div
              id={fid("m-summary")}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-4">{summary}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-6">
        {/* Honeypot */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Leave this empty
            <input {...honeypotProps} />
          </label>
        </div>
        <Turnstile action="checkout" />

        <div aria-live="assertive" aria-atomic="true">
          {formMessage && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
              {formMessage}
            </p>
          )}
        </div>

        {syncNotice && (
          <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {syncNotice}
          </p>
        )}

        <Section step={1} title="Contact details" subtitle={accountMode === "remote" ? "Signed in – details pre-filled" : "No account needed – checkout as a guest"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={fid("name")} label="Full name" required error={errors.name} className="sm:col-span-2">
              <input {...fieldAria(fid("name"), errors.name)} name="name" autoComplete="name" value={f.name} onChange={set("name")} maxLength={80} required />
            </Field>
            <Field id={fid("phone")} label="Mobile number" required error={errors.phone} hint="We'll call / WhatsApp this number to confirm your order">
              <input
                {...fieldAria(fid("phone"), errors.phone, "hint")}
                name="phone"
                type="tel"
                inputMode={pkAddr ? "numeric" : "tel"}
                autoComplete={pkAddr ? "tel-national" : "tel"}
                placeholder={phonePlaceholder(shipTo)}
                value={f.phone}
                onChange={set("phone")}
                maxLength={pkAddr ? 12 : 20}
                required
              />
            </Field>
            <Field id={fid("email")} label="Email" optional={!emailNeeded} error={errors.email} hint={emailNeeded ? "Your order confirmation is emailed here" : "For your order confirmation email"}>
              <input {...fieldAria(fid("email"), errors.email, "hint")} name="email" type="email" autoComplete="email" required={emailNeeded} placeholder="you@example.com" value={f.email} onChange={set("email")} maxLength={120} />
            </Field>
          </div>
        </Section>

        <Section step={2} title="Delivery address" subtitle={countries.length > 1 ? `We deliver to ${countries.map((c) => countryInText(c)).join(", ").replace(/, ([^,]*)$/, " and $1")}` : pk ? "We deliver all over Pakistan via TCS, Leopards, M&P, Trax, PostEx & Call Courier" : `We deliver ${deliveryArea(loc.country)}`}>
          {addresses.length > 0 && (
            <div className="mb-5">
              <p className="label">Saved addresses</p>
              <div className="snap-row scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      const to = a.country && countries.includes(a.country) ? a.country : loc.country;
                      setShipTo(to);
                      setF((s) => ({ ...s, name: a.name || s.name, phone: a.phone ? formatPhoneInput(a.phone, to) : s.phone, city: a.city, region: a.region ?? "", postalCode: a.postalCode ?? "", address: a.address, landmark: a.landmark ?? "" }));
                      setErrors({});
                    }}
                    className={cn(
                      "w-56 rounded-2xl border p-3 text-left text-sm transition-colors",
                      f.address === a.address && f.city === a.city ? "border-violet-500/70 bg-violet-500/10" : "border-border-strong bg-surface hover:border-violet-500/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <BookmarkCheck className="size-4 text-violet-300" aria-hidden="true" /> {a.label}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted">
                      {a.address}, {a.city}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {countries.length > 1 && (
              <Field id={fid("country")} label="Country" required className="sm:col-span-2">
                <select
                  {...fieldAria(fid("country"))}
                  name="country"
                  autoComplete="country"
                  value={shipTo}
                  onChange={(e) => {
                    const next = e.target.value;
                    // the Pakistani city list and a typed city don't carry over
                    if ((next === "PK") !== pkAddr) setF((s) => ({ ...s, city: "" }));
                    setShipTo(next);
                    setErrors((er) => ({ ...er, city: undefined, phone: undefined }));
                  }}
                >
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {pkAddr ? (
              <CityCombobox
                country="PK"
                id={fid("city")}
                value={f.city}
                onChange={(city) => {
                  setF((s) => ({ ...s, city }));
                  setErrors((er) => ({ ...er, city: undefined }));
                }}
                required
                error={errors.city}
                className="sm:col-span-2"
              />
            ) : (
              <>
                <Field id={fid("city")} label="City / town" required error={errors.city} className="sm:col-span-2">
                  <input {...fieldAria(fid("city"), errors.city)} name="city" autoComplete="address-level2" value={f.city} onChange={set("city")} maxLength={80} required />
                </Field>
                <Field id={fid("region")} label="State / province" optional error={errors.region}>
                  <input {...fieldAria(fid("region"), errors.region)} name="region" autoComplete="address-level1" value={f.region} onChange={set("region")} maxLength={60} />
                </Field>
                <Field id={fid("postalCode")} label="Postcode" optional error={errors.postalCode}>
                  <input {...fieldAria(fid("postalCode"), errors.postalCode)} name="postalCode" autoComplete="postal-code" value={f.postalCode} onChange={set("postalCode")} maxLength={12} />
                </Field>
              </>
            )}
            {eta && (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300 sm:col-span-2" aria-live="polite">
                <Truck className="size-4 shrink-0" aria-hidden="true" />
                Estimated delivery to {f.city}: <strong>{eta.label}</strong>
                <span className="ml-auto font-semibold">{delivery === 0 ? "FREE" : money(delivery ?? 0)}</span>
              </p>
            )}
            <Field id={fid("address")} label="Complete address" required error={errors.address} className="sm:col-span-2">
              <textarea
                {...fieldAria(fid("address"), errors.address)}
                name="address"
                autoComplete="street-address"
                rows={3}
                placeholder="House / flat no., street, block, area"
                value={f.address}
                onChange={set("address")}
                maxLength={300}
                required
              />
            </Field>
            <Field id={fid("landmark")} label="Nearest landmark" optional error={errors.landmark}>
              <input {...fieldAria(fid("landmark"), errors.landmark)} name="landmark" placeholder={pkAddr ? "e.g. near Imtiaz Supermarket" : "e.g. opposite the park entrance"} value={f.landmark} onChange={set("landmark")} maxLength={120} />
            </Field>
            <Field id={fid("notes")} label="Order notes" optional error={errors.notes}>
              <input {...fieldAria(fid("notes"), errors.notes)} name="notes" placeholder="Preferred delivery time, etc." value={f.notes} onChange={set("notes")} maxLength={500} />
            </Field>
            {accountMode !== "none" && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted sm:col-span-2">
                <input type="checkbox" name="saveAddress" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-4 accent-violet-500" />
                Save this address for next time
              </label>
            )}
            {/* never ticked for the customer: marketing needs a clear yes (for this store only) */}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted sm:col-span-2">
              <input type="checkbox" name="marketingConsent" className="size-4 accent-violet-500" />
              Email me news and offers from this store (you can say no at any time)
            </label>
          </div>
        </Section>

        <Section step={3} title="Payment method" subtitle={pk ? "Cash on Delivery available in every city" : methods.some((m) => m.id === "cod") ? "Cash on Delivery available" : "Choose how you'd like to pay"}>
          <fieldset aria-describedby={errors.paymentMethod ? fid("pm-error") : undefined}>
            <legend className="sr-only">Choose a payment method</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {methods.map((m) => (
                <PayOption key={m.id} id={fid(`pm-${m.id}`)} value={m.id} current={method} onSelect={setMethod} icon={METHOD_ICON[m.icon]} title={m.id === "card" ? "Debit / credit card" : m.label} desc={methodDescription(m, settings, fee, money)} badge={m.id === "cod" ? "Most popular" : undefined} />
              ))}
            </div>
            {errors.paymentMethod && (
              <p id={fid("pm-error")} className="mt-2 text-xs font-medium text-rose-400">
                {errors.paymentMethod}
              </p>
            )}
          </fieldset>

          <AnimatePresence mode="wait" initial={false}>
            {needsProof && (
              <motion.div key={method} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold">
                    Send <span className="gradient-text font-bold">{money(total)}</span> via {current?.label} to:
                  </p>
                  <dl className="mt-2 grid gap-1.5 text-sm">
                    {accountLines.map((l) => (
                      <div key={l.label} className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-muted">{l.label}</dt>
                        <dd className="select-all font-mono font-semibold">{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {current?.instructions && <p className="mt-2 whitespace-pre-line text-sm">{current.instructions}</p>}
                  <p className="mt-2 text-xs text-muted">Then upload the payment screenshot below. We&apos;ll verify it and confirm your order.</p>
                </div>
                <ProofUpload id={fid("screenshot")} required file={file} preview={preview} error={errors.screenshot} onPick={pickFile} onClear={() => setFile(null)} />
                <div>
                  <label htmlFor={fid("paymentReference")} className="text-sm font-medium">
                    Transaction ID
                  </label>
                  <input
                    id={fid("paymentReference")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    inputMode="text"
                    autoComplete="off"
                    maxLength={40}
                    aria-invalid={Boolean(errors.paymentReference)}
                    aria-describedby={errors.paymentReference ? fid("paymentReference-error") : undefined}
                    className="input mt-1.5 w-full font-mono"
                    placeholder="From your payment SMS / receipt"
                  />
                  {errors.paymentReference && (
                    <p id={fid("paymentReference-error")} className="mt-1.5 text-xs font-medium text-rose-400">
                      {errors.paymentReference}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
            {advanceEligible && (
              <motion.div key="advance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="text-sm">
                  <p className="font-semibold text-amber-200">{advanceRequired ? "Advance payment needed for this order" : "Advance payment for high-value COD orders"}</p>
                  <p className="mt-1 text-muted">
                    Pay {money(Math.min(settings.advanceAmount, total))} advance via{" "}
                    {advanceTargets.join(", ").replace(/, ([^,]*)$/, " or $1")}{" "}
                    {advanceRequired ? "to confirm this order." : "to confirm high-value COD orders."} {method === "cod" ? "The rest is paid in cash on delivery." : "The rest is paid on delivery."}
                  </p>
                  {!advanceRequired && <p className="mt-1 text-xs text-subtle">Optional now – you can also send the screenshot on WhatsApp later.</p>}
                </div>
                <ProofUpload id={fid("screenshot")} required={advanceRequired} file={file} preview={preview} error={errors.screenshot} onPick={pickFile} onClear={() => setFile(null)} label="Advance payment screenshot" />
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <div className="hidden lg:block">
          <SubmitButton pending={pending} total={total} />
          <TrustLine />
        </div>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Order summary">
        <div className="card p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Order summary</h2>
          {summary}
        </div>
      </aside>

      {/* Mobile: inline button + trust, then sticky bar above bottom nav */}
      <div className="space-y-3 lg:hidden">
        <TrustLine />
      </div>
      <div className="glass fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-x-0 px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted">Total</p>
          <p className="font-display text-lg font-bold tabular-nums">{money(total)}</p>
        </div>
        <SubmitButton pending={pending} total={total} compact />
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </form>
  );
}

/** The line under a payment option: the store's note, else what it means. */
function methodDescription(m: CheckoutMethod, settings: StoreSettings, fee: number, money: (n: number) => string) {
  if (m.note) return m.note;
  switch (m.id) {
    case "cod":
      return fee > 0 ? `Pay the rider in cash when your order arrives · ${money(fee)} COD fee` : "Pay the rider in cash when your order arrives";
    case "jazzcash":
      return `Send to ${settings.jazzcash.number}`;
    case "easypaisa":
      return `Send to ${settings.easypaisa.number}`;
    case "bank":
      return settings.bank.bankName;
    case "card":
      return "Pay securely on the next page";
  }
  if (m.due === "on-delivery") return "Pay when your order arrives";
  return m.account[0] ? `${m.account[0].label}: ${m.account[0].value}` : "Pay, then upload the receipt";
}

function Section({ step, title, subtitle, children }: { step: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`checkout-step-${step}`}>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">{step}</span>
        <div>
          <h2 id={`checkout-step-${step}`} className="font-display text-lg font-bold leading-tight">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function PayOption({
  id,
  value,
  current,
  onSelect,
  icon: Icon,
  title,
  desc,
  badge,
  disabled,
  className,
}: {
  id: string;
  value: string;
  current: string;
  onSelect: (m: string) => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  badge?: string;
  disabled?: boolean;
  className?: string;
}) {
  const checked = current === value;
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500/60",
        checked ? "border-violet-500/70 bg-violet-500/10" : "border-border-strong bg-surface hover:border-violet-500/40",
        disabled && "cursor-not-allowed opacity-55 hover:border-border-strong",
        className
      )}
    >
      <input id={id} type="radio" name="paymentMethod" value={value} checked={checked} disabled={disabled} onChange={() => onSelect(value)} className="sr-only" />
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", checked ? "bg-brand-gradient text-white" : "bg-surface-strong text-muted")}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {title}
          {badge && <span className="chip border-emerald-500/40 bg-emerald-500/10 py-0 text-[10px] text-emerald-300">{badge}</span>}
          {disabled && <span className="chip py-0 text-[10px] text-muted">Coming soon</span>}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{desc}</span>
      </span>
      <span className={cn("mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2", checked ? "border-violet-400" : "border-border-strong")} aria-hidden="true">
        {checked && <span className="size-2.5 rounded-full bg-violet-400" />}
      </span>
    </label>
  );
}

function ProofUpload({
  id,
  file,
  preview,
  error,
  required,
  onPick,
  onClear,
  label = "Payment screenshot",
}: {
  id: string;
  file: File | null;
  preview: string | null;
  error?: string;
  required?: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  label?: string;
}) {
  return (
    <div>
      <p className="label" id={`${id}-label`}>
        {label} {required ? <span className="text-rose-400" aria-hidden="true">*</span> : <span className="font-normal text-subtle">(optional)</span>}
      </p>
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border-strong bg-surface p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected payment screenshot preview" className="size-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button type="button" onClick={onClear} className="btn btn-ghost btn-icon" aria-label="Remove screenshot">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500/60",
            error ? "border-rose-500/60 bg-rose-500/5" : "border-border-strong hover:border-violet-500/50"
          )}
        >
          <ImageUp className="size-7 text-violet-300" aria-hidden="true" />
          <span className="text-sm font-semibold">Tap to upload screenshot</span>
          <span className="text-xs text-muted">JPG, PNG or WebP · max 5 MB</span>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onPick}
            aria-labelledby={`${id}-label`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </label>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ pending, total, compact }: { pending: boolean; total: number; compact?: boolean }) {
  const money = useMoney();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={cn("btn btn-primary", compact ? "flex-1" : "btn-lg w-full")}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Placing order…
        </>
      ) : (
        <>
          <Lock className="size-4" aria-hidden="true" /> {compact ? "Place order" : `Place order · ${money(total)}`}
        </>
      )}
    </button>
  );
}

function TrustLine() {
  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted">
      <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
      Secure checkout · Checked & tested products · Easy returns
    </p>
  );
}

function OrderSummary({
  settings,
  coupon,
  subtotal,
  discount,
  delivery,
  codFee: fee,
  tax,
  taxAdded,
  total,
  eta,
  city,
  postalCode,
  country,
}: {
  settings: StoreSettings;
  coupon: ReturnType<typeof useCartCoupon>;
  subtotal: number;
  discount: number;
  delivery: number | null;
  codFee: number;
  tax: number;
  taxAdded: number;
  total: number;
  eta: string | null;
  city: string;
  postalCode: string;
  country: string;
}) {
  const lines = useCart((s) => s.lines);
  const money = useMoney();
  const freeAbove = freeDeliveryAbove(city, settings, postalCode, country);
  // free delivery is judged on the items after any discount (same as the server)
  const remaining = coupon.freeShipping || freeAbove <= 0 ? 0 : Math.max(0, freeAbove - (subtotal - discount));
  return (
    <div className="space-y-4">
      <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {lines.map((l) => (
          <li key={l.key} className="flex gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
              {l.image && <Image src={l.image} alt={l.name} fill sizes="64px" className="object-contain p-1" />}
              <span className="absolute -right-0 -top-0 grid size-5 place-items-center rounded-bl-lg bg-violet-500 text-[10px] font-bold text-white">{l.qty}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{l.name}</p>
              {l.upgrades.length > 0 && <p className="mt-0.5 text-xs text-violet-300">+ {l.upgrades.map((u) => u.label).join(", ")}</p>}
            </div>
            <p className="text-sm font-semibold tabular-nums">{money(l.unitPrice * l.qty)}</p>
          </li>
        ))}
      </ul>
      <Link href="/cart" className="inline-block text-xs font-semibold text-violet-300 hover:text-violet-200">
        Edit cart
      </Link>
      <CouponBox coupon={coupon} />
      <dl className="space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{money(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-400">
            <dt>{coupon.code ? `Discount (${coupon.code})` : "Discount"}</dt>
            <dd className="tabular-nums">− {money(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery{city ? ` to ${city}` : ""}</dt>
          <dd className="tabular-nums">
            {delivery === null ? <span className="text-muted">Choose city</span> : delivery === 0 ? <span className="font-semibold text-emerald-400">FREE</span> : money(delivery)}
          </dd>
        </div>
        {fee > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Cash on Delivery fee</dt>
            <dd className="tabular-nums">{money(fee)}</dd>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">{taxAdded > 0 ? settings.tax?.label || "Tax" : `Incl. ${settings.tax?.label || "tax"}`}</dt>
            <dd className="tabular-nums">{taxAdded > 0 ? money(taxAdded) : money(tax)}</dd>
          </div>
        )}
        {eta && (
          <div className="flex justify-between text-xs">
            <dt className="text-muted">Estimated delivery</dt>
            <dd>{eta}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums">{money(total)}</dd>
        </div>
      </dl>
      {remaining > 0 && (
        <p className="rounded-xl bg-surface-strong px-3 py-2 text-xs text-muted">
          Add <strong className="text-fg">{money(remaining)}</strong> more for FREE delivery.
        </p>
      )}
    </div>
  );
}

/** Same heights as the real sections (contact, delivery, payment, place order) so the page doesn't jump when the form appears. */
const SKELETON_CARDS = ["h-[24.5rem] lg:h-[18.5rem]", "h-[31.5rem] lg:h-[26rem]", "h-[20.5rem] lg:h-[17.25rem]"];

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start xl:gap-10" aria-busy="true" aria-label="Loading checkout">
      <div className="space-y-6">
        <Skeleton className="h-14 w-full rounded-3xl lg:hidden" />
        {SKELETON_CARDS.map((h) => (
          <div key={h} className={cn("card space-y-4 p-5 sm:p-6", h)}>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
        <Skeleton className="h-[12.5rem] w-full rounded-3xl lg:h-32" />
      </div>
      <Skeleton className="hidden h-[30rem] w-full rounded-3xl lg:block" />
    </div>
  );
}
