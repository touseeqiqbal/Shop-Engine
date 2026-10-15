"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { priceCart } from "@/lib/cart-pricing";
import { resolveDiscounts } from "@/lib/coupons";
import { orderTotals } from "@/lib/order-totals";
import { PAKISTAN_CITIES, shippingZoneFor } from "@/lib/cities";
import { findCheckoutMethod } from "@/lib/payments/methods";
import { storeLocale, type StoreLocale } from "@/lib/locale";
import { moneyFormatter } from "@/lib/money";
import { normalizePhone, phonePlaceholder } from "@/lib/phone";
import { advanceReason, getProtectionSettings, isBlockedPhone, needsConfirmation, newConfirmation, riskFor } from "@/lib/protection";
import { emailRequiredAtCheckout, getSessionUser, getUserProfile, mustConfirmEmailToOrder, updateUserProfile } from "@/lib/auth";
import { canAskForConfirmation, notifyFromStorefront } from "@/lib/notify";
import { rateLimit, rateLimitKey, rateLimitPeek } from "@/lib/rate-limit";
import { getOne, upsert } from "@/lib/repo/db";
import { generateOrderNumber, getOrderByNumber, insertOrder } from "@/lib/repo/orders";
import { getStoreSettings, TAGS } from "@/lib/repo/catalog";
import { isCmsConfigured, isDatabaseConfigured } from "@/lib/db/config";
import { deleteObject, uploadObject } from "@/lib/storage";
import type { Order, OrderConfirmation, OrderRisk } from "@/lib/types";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";
import { currentAvailability, storeOrigin } from "@/lib/tenant";

import { LAST_ORDER_COOKIE, orderCookieValue } from "@/lib/order-cookie";
import { addCustomerOf, addMarketingConsent, isBlockedCustomer, linkOrderToCustomerCms, placeOrderCms } from "@/lib/cms/sales";
import { payloadClient } from "@/lib/cms/catalog-source";
import { log } from "@/lib/log";
import { closeDraftForOrder } from "@/lib/cms/engagement";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";
const MAX_FILE = 5 * 1024 * 1024;
const ATTEMPT_ID = /^[A-Za-z0-9-]{8,64}$/;
/** A transfer / wallet receipt's transaction id (UPI UTR, M-Pesa code, PIX id …). */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/-]{3,59}$/;

export type CheckoutField = "name" | "phone" | "email" | "city" | "region" | "postalCode" | "address" | "landmark" | "notes" | "paymentMethod" | "screenshot" | "paymentReference" | "items";

export type PlaceOrderState =
  | { ok: false; message?: string; fieldErrors?: Partial<Record<CheckoutField, string>>; ts?: number; requireAdvance?: boolean; couponError?: string; newTotal?: number }
  | { ok: true; orderNumber: string; total: number; items: { id: string; name: string; price: number; quantity: number }[]; ts: number; paymentUrl?: string };

/** The checkout form's rules for a store's country: Pakistan picks a city from the list; elsewhere city, state and postcode are typed. */
const checkoutSchema = (loc: StoreLocale) =>
  z.object({
  name: z.string().trim().min(3, "Please enter your full name").max(80, "Name is too long"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v, loc.country);
      if (!n) {
        ctx.addIssue({ code: "custom", message: loc.country === "PK" ? "Enter a valid mobile number, e.g. 0300-1234567" : `Enter a valid phone number, e.g. ${phonePlaceholder(loc.country)}` });
        return z.NEVER;
      }
      return n;
    }),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(120)]),
  city:
    loc.country === "PK"
      ? z.string().refine((c) => PAKISTAN_CITIES.includes(c), "Please choose your city from the list")
      : z.string().trim().min(2, "Please enter your city").max(80, "City name is too long"),
  region: z.string().trim().max(60, "State / province is too long"),
  postalCode: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/, "Enter a valid postcode")]),
  address: z.string().trim().min(loc.country === "PK" ? 10 : 5, "Please enter your complete address (house, street, area)").max(300, "Address is too long"),
  landmark: z.string().trim().max(120, "Landmark is too long"),
  notes: z.string().trim().max(500, "Notes are too long"),
  paymentMethod: z.string().trim().min(1, "Choose a payment method").max(40, "Choose a payment method"),
  paymentReference: z.union([z.literal(""), z.string().trim().regex(REFERENCE, "Enter the transaction ID from your payment receipt")]),
  couponCode: z.string().trim().max(40),
  saveAddress: z.boolean(),
  marketingConsent: z.boolean(),
  items: z
    .array(z.object({ productId: z.string().min(1).max(120), qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM, `You can order up to ${MAX_QTY_PER_ITEM} of one item online – for more, ask us on WhatsApp`), upgradeIds: z.array(z.string().max(120)).max(10) }))
    .min(1, "Your cart is empty")
    .max(30, "Too many items in one order"),
  });

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function parseItems(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Checks the real file signature, not just the browser-reported MIME type. */
async function sniffImage(file: File): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

/** Uploads to the PRIVATE `payments/` prefix (S3, or .data/uploads in demo mode) and returns the object KEY. */
async function storeScreenshot(file: File, type: string, orderNumber: string): Promise<string> {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `payments/${orderNumber}/${orderNumber}-${randomUUID().slice(0, 8)}.${ext}`;
  await uploadObject(key, buffer, type);
  return key;
}

/** Lets this browser see its order's confirmation page (signed – see order-cookie.ts). */
async function setOrderCookie(orderNumber: string) {
  (await cookies()).set(LAST_ORDER_COOKIE, orderCookieValue(orderNumber), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

const CLOSED_MESSAGE: Record<string, string> = {
  "setting-up": "This shop isn't open yet – please check back soon.",
  "plan-ended": "This shop is temporarily not taking orders.",
  suspended: "This shop is temporarily not taking orders.",
  closed: "This shop has closed.",
  missing: "This shop doesn't exist.",
};

export async function placeOrder(_prev: PlaceOrderState, fd: FormData): Promise<PlaceOrderState> {
  const ts = Date.now();
  // Honeypot – real shoppers never see/fill this field.
  if (str(fd, HONEYPOT)) return { ok: false, message: "We couldn't place your order. Please contact us on WhatsApp.", ts };
  if (!(await verifyTurnstile(fd, "checkout"))) return { ok: false, message: BOT_MESSAGE, ts };

  // the store this checkout is for (from the address the shopper is on) – it must be open for orders
  const { store, availability } = await currentAvailability();
  if (!availability.open) return { ok: false, message: CLOSED_MESSAGE[availability.reason] ?? CLOSED_MESSAGE.closed, ts };
  const storeId = store?.id ?? null;
  // the store's country, currency and time zone: address form, phone numbers and amounts follow them
  const loc = storeLocale(store);
  const money = moneyFormatter(loc);

  const parsed = checkoutSchema(loc).safeParse({
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    email: str(fd, "email").trim(),
    city: str(fd, "city"),
    region: str(fd, "region"),
    postalCode: str(fd, "postalCode"),
    address: str(fd, "address"),
    landmark: str(fd, "landmark"),
    notes: str(fd, "notes"),
    paymentMethod: str(fd, "paymentMethod") || "cod",
    paymentReference: str(fd, "paymentReference").trim(),
    couponCode: str(fd, "couponCode"),
    saveAddress: str(fd, "saveAddress") === "on",
    marketingConsent: str(fd, "marketingConsent") === "on",
    items: parseItems(str(fd, "items")),
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CheckoutField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "") as CheckoutField;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: fieldErrors.items ?? "Please check the highlighted fields.", fieldErrors, ts };
  }
  const data = parsed.data;

  // Email is how we verify: every order needs one (receipt, cash-on-delivery confirmation link and code, the
  // customer record in /cms), and a signed-in customer must have confirmed their account's email.
  // Both only once the shop can actually send email. Card payments always need one (the payment receipt).
  const user = await getSessionUser().catch(() => null);
  if ((emailRequiredAtCheckout() || data.paymentMethod === "card") && !data.email)
    return { ok: false, message: "Please enter your email – we send your order confirmation there.", fieldErrors: { email: "Enter your email address" }, ts };
  if (user && (await mustConfirmEmailToOrder(user)))
    return { ok: false, message: "Please confirm your email address first – open the link we sent you (or send it again from your account page), then place the order.", ts };

  // Attempts per network are generous (shared mobile IPs, sold-out retries); placed orders per phone are strict.
  if (!(await rateLimit("checkout", 20, 10 * 60_000)))
    return { ok: false, message: "Too many tries from your network in a short time. Please wait a few minutes or order on WhatsApp.", ts };
  if (!rateLimitPeek(`checkout-phone:${storeId ?? 0}:${data.phone}`, 5))
    return { ok: false, message: "Several orders were just placed with this number. Please wait a while or order on WhatsApp.", ts };

  // ── Re-price everything server-side, from this store's catalog and settings ──
  const [settings, priced] = await Promise.all([getStoreSettings(storeId), priceCart(data.items, { checkStock: true })]);
  if (priced.problems.length || priced.items.length === 0)
    return { ok: false, message: priced.problems[0] ?? "Your cart is empty.", fieldErrors: { items: priced.problems.join(" ") || "Your cart is empty" }, ts };
  // the method must be one this store offers right now (built-in, the store's own, or its connected card provider)
  const method = findCheckoutMethod(data.paymentMethod, settings);
  if (!method)
    return { ok: false, message: "This payment method isn't available right now – please choose another.", fieldErrors: { paymentMethod: "Please choose another payment method" }, ts };
  const card = method.kind === "gateway";
  const payOnDelivery = method.due === "on-delivery";

  const subtotal = priced.subtotal;
  // the typed code and/or the best automatic discount (never place the order at a higher total than the customer saw)
  const discounts = await resolveDiscounts(data.couponCode || null, { lines: priced.items, products: priced.products, subtotal, customer: { email: data.email || null, phone: data.phone }, storeId });
  if (!discounts.ok) return { ok: false, message: `${discounts.message}. Remove the code or try another one, then place the order again.`, couponError: discounts.message, ts };
  const discount = discounts.discount;
  // the code whose use is counted: the typed one, else a lone automatic discount (its usage limit / per-customer limit)
  const couponCode = discounts.code ?? (discounts.applied.length === 1 ? discounts.applied[0].code : null);

  // COD handling fee (/cms → Settings → Payments) is recorded as part of the delivery charge
  const totals = orderTotals({ subtotal, discount, city: data.city, postalCode: data.postalCode, method: data.paymentMethod, settings, freeShipping: discounts.freeShipping });
  const delivery = (totals.delivery ?? 0) + totals.fee;
  const total = totals.total;
  const expected = Number(str(fd, "expectedTotal"));
  // any difference the shopper would notice (a rupee, a cent …)
  if (Number.isFinite(expected) && expected > 0 && money.round(Math.abs(expected - total)) > 0)
    return {
      ok: false,
      newTotal: total,
      message: `The total changed to ${money(total)} (prices, discounts or delivery were updated). Please check your order and place it again.`,
      ts,
    };
  const codMax = settings.payments?.cod.maxOrder ?? null;
  if (data.paymentMethod === "cod" && codMax && total > codMax)
    return { ok: false, message: `Cash on Delivery is available for orders up to ${money(codMax)}. Please pay online.`, fieldErrors: { paymentMethod: "Choose an online payment method for this order" }, ts };

  // ── Fake-order protection (this store's blocked numbers and rules): risk score, advance payment for risky COD ──
  let risk: OrderRisk | null = null;
  let advanceNeeded: string | null = null;
  if (isCmsConfigured) {
    try {
      const prot = await getProtectionSettings(storeId);
      const r = await riskFor(data.phone, prot, storeId);
      if (r.blocked?.action === "block")
        return { ok: false, message: "We can't take online orders for this number. Please call or WhatsApp us to order.", fieldErrors: { phone: "Online orders are not available for this number" }, ts };
      // a customer ACCOUNT blocked by the original shop's staff (/cms → Customers) can't order there as a guest either
      if ((!store || store.isDefault) && (await isBlockedCustomer(data.phone, data.email)))
        return { ok: false, message: "We can't take online orders for this account. Please call or WhatsApp us to order.", ts };
      risk = { score: r.score, level: r.level, reasons: r.reasons };
      if (payOnDelivery) {
        advanceNeeded = advanceReason(r, data.city, prot);
        if (advanceNeeded && settings.advanceAmount <= 0)
          return {
            ok: false,
            message: `Cash on delivery isn't available here (${advanceNeeded}). Please choose an online payment method.`,
            fieldErrors: { paymentMethod: "Please choose an online payment method" },
            ts,
          };
      }
    } catch (err) {
      // never block a real customer because the scoring failed – but the blocked list itself still applies
      log.error("checkout.risk_check_failed", err);
      if (await isBlockedPhone(data.phone, storeId).catch(() => false))
        return { ok: false, message: "We can't take online orders for this number. Please call or WhatsApp us to order.", fieldErrors: { phone: "Online orders are not available for this number" }, ts };
    }
  }

  // ── Payment proof (wallet / bank transfer / the store's own methods: screenshot + transaction id; cards are checked by the provider) ──
  const advanceEligible = payOnDelivery && ((total >= settings.advanceThreshold && settings.advanceAmount > 0) || Boolean(advanceNeeded));
  const rawFile = fd.get("screenshot");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const needsProof = method.proof;
  if (needsProof && !file)
    return { ok: false, message: "Please upload your payment screenshot.", fieldErrors: { screenshot: "Upload a screenshot of your payment (JPG, PNG or WebP)" }, ts };
  if (needsProof && !data.paymentReference)
    return { ok: false, message: "Please enter the transaction ID of your payment.", fieldErrors: { paymentReference: "Enter the transaction ID from your payment receipt" }, ts };
  if (advanceNeeded && !file)
    return {
      ok: false,
      requireAdvance: true,
      message: `For ${method.id === "cod" ? "cash on delivery" : `${method.label} on delivery`}, ${advanceNeeded}: please pay ${money(Math.min(settings.advanceAmount, total))} in advance and upload the screenshot. The rest is paid on delivery.`,
      fieldErrors: { screenshot: "Upload the screenshot of your advance payment" },
      ts,
    };

  let proofType: string | null = null;
  if (file && (needsProof || advanceEligible)) {
    if (file.size > MAX_FILE) return { ok: false, message: "Screenshot is too large.", fieldErrors: { screenshot: "Image must be 5 MB or smaller" }, ts };
    proofType = await sniffImage(file);
    if (!proofType) return { ok: false, message: "Unsupported screenshot format.", fieldErrors: { screenshot: "Only JPG, PNG or WebP images are allowed" }, ts };
  }

  const now = new Date();
  const prefix = store?.orderPrefix || undefined;
  let orderNumber = generateOrderNumber(now, prefix, loc.timezone);
  for (let i = 0; i < 4 && (await getOrderByNumber(orderNumber)); i++) orderNumber = generateOrderNumber(now, prefix, loc.timezone);

  let screenshotUrl: string | null = null;
  if (file && proofType) {
    try {
      screenshotUrl = await storeScreenshot(file, proofType, orderNumber);
    } catch (err) {
      log.error("checkout.screenshot", err);
      return { ok: false, message: "We couldn't upload your screenshot. Please try again or send it on WhatsApp.", fieldErrors: { screenshot: "Upload failed – please try again" }, ts };
    }
  }

  const advancePaid = advanceEligible && screenshotUrl ? Math.min(settings.advanceAmount, total) : undefined;

  // COD orders the customer must confirm (link / code) before we pack them
  let confirmation: OrderConfirmation | null = null;
  if (isCmsConfigured && !card) {
    const prot = await getProtectionSettings(storeId).catch(() => null);
    const zoneName = shippingZoneFor(data.city, settings, data.postalCode)?.name ?? null;
    // An uploaded advance isn't checked yet, so it can't replace the confirmation; approving it in /cms confirms the order.
    // …and only when we can actually send the customer the link/code; otherwise staff confirm by phone.
    if (prot && needsConfirmation({ paymentMethod: method.id, paymentDue: method.due, total, zoneName, advancePaid: false }, prot)) {
      if (canAskForConfirmation(data.email)) confirmation = newConfirmation(prot);
      else log.warn("checkout.confirmation_unreachable", { phone: data.phone.slice(-4) });
    }
  }
  // a card order waits for the payment provider; it moves on (or is cancelled) by itself
  const firstStatus = card ? "awaiting-payment" : confirmation ? "awaiting-confirmation" : "pending";
  const order: Order = {
    id: randomUUID(),
    orderNumber,
    createdAt: now.toISOString(),
    status: firstStatus,
    customer: {
      name: data.name,
      phone: data.phone,
      ...(data.email ? { email: data.email.toLowerCase() } : {}),
      city: data.city,
      address: data.address,
      ...(data.landmark ? { landmark: data.landmark } : {}),
      ...(data.region ? { region: data.region } : {}),
      ...(data.postalCode ? { postalCode: data.postalCode.toUpperCase() } : {}),
      country: loc.country,
    },
    items: priced.items,
    subtotal,
    discount,
    couponCode,
    deliveryCharge: delivery,
    taxTotal: totals.tax,
    total,
    ...(advancePaid ? { advancePaid } : {}),
    paymentMethod: method.id,
    paymentMethodLabel: method.label,
    paymentDue: method.due,
    currency: loc.currency,
    paymentStatus: payOnDelivery ? (advancePaid ? "awaiting-verification" : "unpaid") : card ? "unpaid" : "awaiting-verification",
    paymentScreenshotUrl: screenshotUrl,
    paymentReference: needsProof ? data.paymentReference.toUpperCase() : null,
    courier: null,
    trackingNumber: null,
    notes: data.notes || null,
    marketingConsent: data.marketingConsent,
    history: [{ status: firstStatus, at: now.toISOString() }],
    confirmation,
    risk,
    userId: user && user.role === "customer" ? user.id : null,
    storeId,
  };

  const attemptRaw = str(fd, "attemptId");
  const attemptId = ATTEMPT_ID.test(attemptRaw) ? attemptRaw : null;
  const failed = async (message: string, extra: Partial<Extract<PlaceOrderState, { ok: false }>> = {}): Promise<PlaceOrderState> => {
    if (screenshotUrl) await deleteObject(screenshotUrl).catch((e) => log.error("checkout.screenshot_cleanup_failed", e));
    return { ok: false, message, ts, ...extra };
  };
  const summary = (o: Order) => o.items.map((i) => ({ id: i.productId, name: i.name, price: i.unitPrice, quantity: i.qty }));
  let orderDocId: number | null = null;

  if (isCmsConfigured) {
    // Coupon use, stock, the order, its serial-numbered laptops and its notification in ONE transaction – all or nothing.
    const lines = [...aggregateQty(order)].map(([id, qty]) => ({ id, qty, title: order.items.find((i) => i.productId === id)?.name ?? "an item" }));
    let placed: Awaited<ReturnType<typeof placeOrderCms>> | null = null;
    for (let attempt = 0; attempt < 3 && !placed; attempt++) {
      try {
        placed = await placeOrderCms(order, lines, { attemptId, couponCode });
      } catch (err) {
        // a clashing order number (very rare) – try again with a new one
        if (/unique|duplicate key|invalid/i.test(String((err as Error)?.message)) && /order_number|orderNumber|Order number/i.test(String((err as Error)?.message)) && attempt < 2) {
          order.orderNumber = generateOrderNumber(now, prefix, loc.timezone);
          continue;
        }
        log.error("checkout.save_failed", err, { order: order.orderNumber });
        return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
      }
    }
    if (!placed) return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
    if (!placed.ok) {
      if (placed.reason === "coupon") return failed(`The coupon ${couponCode} has just run out or expired. Remove it and place the order again.`, { couponError: "This coupon can't be used any more" });
      if (placed.reason === "payment-reference")
        return failed("This transaction ID was already used for another order. Please check it – one payment pays for one order.", { fieldErrors: { paymentReference: "This transaction ID was already used" } });
      log.warn("checkout.sold_out", { items: placed.short });
      return failed(`Sorry – ${placed.short.join(", ")} just sold out. Please update your cart.`);
    }
    if (placed.duplicate) {
      // the same submit arrived twice (double click / retry) – show the order that was already placed
      if (screenshotUrl && screenshotUrl !== placed.order.paymentScreenshotUrl) await deleteObject(screenshotUrl).catch(() => undefined);
      await setOrderCookie(placed.order.orderNumber);
      let paymentUrl: string | undefined;
      if (placed.order.status === "awaiting-payment" && method.gateway) {
        const { getGateway } = await import("@/lib/payments/gateways");
        paymentUrl = (await getGateway(method.gateway)?.resumeUrl(await payloadClient(), Number(placed.order.id)).catch(() => null)) ?? undefined;
      }
      return { ok: true, orderNumber: placed.order.orderNumber, total: placed.order.total, items: summary(placed.order), ts, ...(paymentUrl ? { paymentUrl } : {}) };
    }
    order.orderNumber = placed.order.orderNumber;
    orderDocId = Number(placed.order.id);
  } else {
    try {
      await insertOrder(order);
    } catch (err) {
      log.error("checkout.save_failed", err, { order: orderNumber });
      return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
    }
  }
  rateLimitKey(`checkout-phone:${storeId ?? 0}:${data.phone}`, 5, 60 * 60_000);

  // ── Online: on to the payment provider's page (the store's provider plugin). If it can't be opened, the order is cancelled (stock goes back). ──
  let paymentUrl: string | undefined;
  if (card && orderDocId != null && storeId != null) {
    const payload = await payloadClient();
    try {
      const { getGateway } = await import("@/lib/payments/gateways");
      const gateway = getGateway(method.gateway);
      if (!gateway) throw new Error(`payment provider ${method.gateway} not available`);
      const origin = store ? storeOrigin(store) : (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
      paymentUrl = (await gateway.start(payload, { orderId: orderDocId, orderNumber: order.orderNumber, total, currency: loc.currency, storeId, email: order.customer.email ?? null, origin })).url;
    } catch (err) {
      log.error("checkout.card_start_failed", err, { order: order.orderNumber });
      await payload
        .update({
          collection: "orders",
          id: orderDocId,
          data: { status: "cancelled", history: [{ status: "cancelled", at: new Date().toISOString(), note: `${method.label} payment could not be started` }] } as never,
          overrideAccess: true,
          context: { system: true, skipNotify: true },
        })
        .catch((e) => log.error("checkout.card_cancel_failed", e, { order: order.orderNumber }));
      return { ok: false, message: "We couldn't open the payment page. Nothing was charged – please try again or choose another payment method.", fieldErrors: { paymentMethod: `${method.label} is not available right now` }, ts };
    }
  }

  // ── Best-effort side effects (never fail the order) ──
  let stockChanged = isCmsConfigured;
  if (!isCmsConfigured) {
    for (const [productId, qty] of aggregateQty(order)) {
      try {
        const p = await getOne("products", "id", productId);
        if (p) {
          await upsert("products", { ...p, stock: Math.max(0, p.stock - qty), soldCount: (p.soldCount ?? 0) + qty });
          stockChanged = true;
        }
      } catch (err) {
        log.error("checkout.stock_update", err);
      }
    }
    if (couponCode) {
      try {
        const c = await getOne("coupons", "code", couponCode);
        if (c) await upsert("coupons", { ...c, used: (c.used ?? 0) + 1 });
      } catch (err) {
        log.error("checkout.coupon_usage", err);
      }
    }
  }
  if (stockChanged) {
    try {
      updateTag(TAGS.catalog);
    } catch (err) {
      log.error("checkout.revalidate", err);
    }
  }
  if (data.saveAddress && order.userId && isDatabaseConfigured) {
    try {
      const profile = await getUserProfile(order.userId);
      const existing = profile?.addresses ?? [];
      const dup = existing.some((a) => a.address.trim().toLowerCase() === data.address.toLowerCase() && a.city === data.city);
      if (!dup)
        await updateUserProfile(order.userId, {
          addresses: [
            { id: randomUUID(), label: existing.length ? `Address ${existing.length + 1}` : "Home", name: data.name, phone: data.phone, city: data.city, address: data.address, landmark: data.landmark || undefined, region: data.region || undefined, postalCode: data.postalCode || undefined },
            ...existing,
          ],
          ...(profile?.phone ? {} : { phone: data.phone }),
        });
    } catch (err) {
      log.error("checkout.save_address", err);
    }
  }

  await setOrderCookie(order.orderNumber);

  if (isCmsConfigured) {
    // (the "order received" messages were queued with the order itself – see placeOrderCms)
    // the shopper becomes a customer of this store: a signed-in account is linked, a guest gets a customer record
    if (order.userId)
      after(async () => {
        const payload = await payloadClient();
        await addCustomerOf(payload, order.userId, storeId).catch((e) => log.error("checkout.customer_of_failed", e));
        if (data.marketingConsent) await addMarketingConsent(payload, order.userId, storeId).catch((e) => log.error("checkout.consent_failed", e));
      });
    else after(() => linkOrderToCustomerCms(order.orderNumber, { email: order.customer.email, name: order.customer.name, phone: order.customer.phone, storeId, marketingConsent: data.marketingConsent }).catch((e) => log.error("checkout.customer_link_failed", e)));
    after(() => closeDraftForOrder(order.customer.phone, order.customer.email ?? null, order.orderNumber, storeId).catch((e) => log.error("cart.draft_close_failed", e)));
  } else {
    // demo mode (no CMS, no outbox): sent straight after the response
    after(() => notifyFromStorefront("order-placed", { order }));
  }

  return { ok: true, orderNumber: order.orderNumber, total: order.total, items: summary(order), ts, ...(paymentUrl ? { paymentUrl } : {}) };
}

function aggregateQty(order: Order) {
  const m = new Map<string, number>();
  for (const i of order.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
  return m;
}
