"use server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { priceCart } from "@/lib/cart-pricing";
import { checkCoupon } from "@/lib/coupons";
import { codFee, deliveryCharge, PAKISTAN_CITIES, paymentEnabled, shippingZoneFor } from "@/lib/cities";
import { advanceReason, getProtectionSettings, isBlockedPhone, needsConfirmation, newConfirmation, riskFor } from "@/lib/protection";
import { emailRequiredAtCheckout, getSessionUser, getUserProfile, mustConfirmEmailToOrder, updateUserProfile } from "@/lib/auth";
import { canAskForConfirmation, notifyNewOrder } from "@/lib/notify";
import { rateLimit, rateLimitKey, rateLimitPeek } from "@/lib/rate-limit";
import { getOne, upsert } from "@/lib/repo/db";
import { generateOrderNumber, getOrderByNumber, insertOrder } from "@/lib/repo/orders";
import { getStoreSettings, TAGS } from "@/lib/repo/catalog";
import { isCmsConfigured, isDatabaseConfigured } from "@/lib/db/config";
import { deleteObject, uploadObject } from "@/lib/storage";
import type { Order, OrderConfirmation, OrderRisk, PaymentMethod } from "@/lib/types";
import { normalizePkPhone } from "@/lib/utils";
import { MAX_QTY_PER_ITEM } from "@/lib/cart-limits";

import { LAST_ORDER_COOKIE, orderCookieValue } from "@/lib/order-cookie";
import { isBlockedCustomer, linkOrderToCustomerCms, placeOrderCms } from "@/lib/cms/sales";
import { log } from "@/lib/log";
import { closeDraftForOrder } from "@/lib/cms/engagement";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { HONEYPOT } from "@/lib/honeypot";
const MAX_FILE = 5 * 1024 * 1024;
const ATTEMPT_ID = /^[A-Za-z0-9-]{8,64}$/;
const ONLINE: PaymentMethod[] = ["jazzcash", "easypaisa", "bank"];

export type CheckoutField = "name" | "phone" | "email" | "city" | "address" | "landmark" | "notes" | "paymentMethod" | "screenshot" | "items";

export type PlaceOrderState =
  | { ok: false; message?: string; fieldErrors?: Partial<Record<CheckoutField, string>>; ts?: number; requireAdvance?: boolean; couponError?: string; newTotal?: number }
  | { ok: true; orderNumber: string; total: number; items: { id: string; name: string; price: number; quantity: number }[]; ts: number };

const schema = z.object({
  name: z.string().trim().min(3, "Please enter your full name").max(80, "Name is too long"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePkPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 0300-1234567" });
        return z.NEVER;
      }
      return n;
    }),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(120)]),
  city: z.string().refine((c) => PAKISTAN_CITIES.includes(c), "Please choose your city from the list"),
  address: z.string().trim().min(10, "Please enter your complete address (house, street, area)").max(300, "Address is too long"),
  landmark: z.string().trim().max(120, "Landmark is too long"),
  notes: z.string().trim().max(500, "Notes are too long"),
  paymentMethod: z.enum(["cod", "jazzcash", "easypaisa", "bank", "card"], "Choose a payment method"),
  couponCode: z.string().trim().max(40),
  saveAddress: z.boolean(),
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

export async function placeOrder(_prev: PlaceOrderState, fd: FormData): Promise<PlaceOrderState> {
  const ts = Date.now();
  // Honeypot – real shoppers never see/fill this field.
  if (str(fd, HONEYPOT)) return { ok: false, message: "We couldn't place your order. Please contact us on WhatsApp.", ts };
  if (!(await verifyTurnstile(fd, "checkout"))) return { ok: false, message: BOT_MESSAGE, ts };

  const parsed = schema.safeParse({
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    email: str(fd, "email").trim(),
    city: str(fd, "city"),
    address: str(fd, "address"),
    landmark: str(fd, "landmark"),
    notes: str(fd, "notes"),
    paymentMethod: str(fd, "paymentMethod") || "cod",
    couponCode: str(fd, "couponCode"),
    saveAddress: str(fd, "saveAddress") === "on",
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

  if (data.paymentMethod === "card")
    return { ok: false, message: "Card payments are coming soon – please choose another method.", fieldErrors: { paymentMethod: "Card payments are coming soon" }, ts };

  // Email is how we verify: every order needs one (receipt, cash-on-delivery confirmation link and code, the
  // customer record in /cms), and a signed-in customer must have confirmed their account's email.
  // Both only once the shop can actually send email.
  const user = await getSessionUser().catch(() => null);
  if (emailRequiredAtCheckout() && !data.email)
    return { ok: false, message: "Please enter your email – we send your order confirmation there.", fieldErrors: { email: "Enter your email address" }, ts };
  if (user && (await mustConfirmEmailToOrder(user)))
    return { ok: false, message: "Please confirm your email address first – open the link we sent you (or send it again from your account page), then place the order.", ts };

  // Attempts per network are generous (shared mobile IPs, sold-out retries); placed orders per phone are strict.
  if (!(await rateLimit("checkout", 20, 10 * 60_000)))
    return { ok: false, message: "Too many tries from your network in a short time. Please wait a few minutes or order on WhatsApp.", ts };
  if (!rateLimitPeek(`checkout-phone:${data.phone}`, 5))
    return { ok: false, message: "Several orders were just placed with this number. Please wait a while or order on WhatsApp.", ts };

  // ── Re-price everything server-side ──
  const [settings, priced] = await Promise.all([getStoreSettings(), priceCart(data.items, { checkStock: true })]);
  if (priced.problems.length || priced.items.length === 0)
    return { ok: false, message: priced.problems[0] ?? "Your cart is empty.", fieldErrors: { items: priced.problems.join(" ") || "Your cart is empty" }, ts };

  const subtotal = priced.subtotal;
  let discount = 0;
  let couponCode: string | null = null;
  if (data.couponCode) {
    const c = await checkCoupon(data.couponCode, subtotal);
    // never place the order at a higher total than the customer saw – tell them instead
    if (!c.ok) return { ok: false, message: `${c.message}. Remove the code or try another one, then place the order again.`, couponError: c.message, ts };
    discount = c.discount;
    couponCode = c.code;
  }
  if (!paymentEnabled(data.paymentMethod, settings))
    return { ok: false, message: "This payment method isn't available right now – please choose another.", fieldErrors: { paymentMethod: "Please choose another payment method" }, ts };
  // COD handling fee (/cms → Settings → Payments) is recorded as part of the delivery charge
  const delivery = deliveryCharge(data.city, subtotal, settings) + (data.paymentMethod === "cod" ? codFee(settings) : 0);
  const total = Math.max(0, subtotal - discount + delivery);
  const expected = Number(str(fd, "expectedTotal"));
  if (Number.isFinite(expected) && expected > 0 && Math.abs(expected - total) >= 1)
    return {
      ok: false,
      newTotal: total,
      message: `The total changed to Rs ${total.toLocaleString("en-PK")} (prices or delivery were updated). Please check your order and place it again.`,
      ts,
    };
  const codMax = settings.payments?.cod.maxOrder ?? null;
  if (data.paymentMethod === "cod" && codMax && total > codMax)
    return { ok: false, message: `Cash on Delivery is available for orders up to Rs ${codMax.toLocaleString("en-PK")}. Please pay online.`, fieldErrors: { paymentMethod: "Choose JazzCash, EasyPaisa or bank transfer for this order" }, ts };

  // ── Fake-order protection: blocked numbers, risk score, advance payment for risky COD orders ──
  let risk: OrderRisk | null = null;
  let advanceNeeded: string | null = null;
  if (isCmsConfigured) {
    try {
      const prot = await getProtectionSettings();
      const r = await riskFor(data.phone, prot);
      if (r.blocked?.action === "block")
        return { ok: false, message: "We can't take online orders for this number. Please call or WhatsApp us to order.", fieldErrors: { phone: "Online orders are not available for this number" }, ts };
      // a customer ACCOUNT blocked by staff (/cms → Customers) can't order as a guest with the same phone or email
      if (await isBlockedCustomer(data.phone, data.email))
        return { ok: false, message: "We can't take online orders for this account. Please call or WhatsApp us to order.", ts };
      risk = { score: r.score, level: r.level, reasons: r.reasons };
      if (data.paymentMethod === "cod") {
        advanceNeeded = advanceReason(r, data.city, prot);
        if (advanceNeeded && settings.advanceAmount <= 0)
          return {
            ok: false,
            message: `Cash on delivery isn't available here (${advanceNeeded}). Please pay with JazzCash, EasyPaisa or bank transfer.`,
            fieldErrors: { paymentMethod: "Please choose JazzCash, EasyPaisa or bank transfer" },
            ts,
          };
      }
    } catch (err) {
      // never block a real customer because the scoring failed – but the blocked list itself still applies
      log.error("checkout.risk_check_failed", err);
      if (await isBlockedPhone(data.phone).catch(() => false))
        return { ok: false, message: "We can't take online orders for this number. Please call or WhatsApp us to order.", fieldErrors: { phone: "Online orders are not available for this number" }, ts };
    }
  }

  // ── Payment proof ──
  const advanceEligible = data.paymentMethod === "cod" && ((total >= settings.advanceThreshold && settings.advanceAmount > 0) || Boolean(advanceNeeded));
  const rawFile = fd.get("screenshot");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const needsProof = ONLINE.includes(data.paymentMethod);
  if (needsProof && !file)
    return { ok: false, message: "Please upload your payment screenshot.", fieldErrors: { screenshot: "Upload a screenshot of your payment (JPG, PNG or WebP)" }, ts };
  if (advanceNeeded && !file)
    return {
      ok: false,
      requireAdvance: true,
      message: `For cash on delivery, ${advanceNeeded}: please pay Rs ${Math.min(settings.advanceAmount, total).toLocaleString("en-PK")} in advance and upload the screenshot. The rest is paid on delivery.`,
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
  let orderNumber = generateOrderNumber(now);
  for (let i = 0; i < 4 && (await getOrderByNumber(orderNumber)); i++) orderNumber = generateOrderNumber(now);

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
  if (isCmsConfigured) {
    const prot = await getProtectionSettings().catch(() => null);
    const zoneName = shippingZoneFor(data.city, settings)?.name ?? null;
    // An uploaded advance isn't checked yet, so it can't replace the confirmation; approving it in /cms confirms the order.
    // …and only when we can actually send the customer the link/code; otherwise staff confirm by phone.
    if (prot && needsConfirmation({ paymentMethod: data.paymentMethod, total, zoneName, advancePaid: false }, prot)) {
      if (canAskForConfirmation(data.email)) confirmation = newConfirmation(prot);
      else log.warn("checkout.confirmation_unreachable", { phone: data.phone.slice(-4) });
    }
  }
  const firstStatus = confirmation ? "awaiting-confirmation" : "pending";
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
    },
    items: priced.items,
    subtotal,
    discount,
    couponCode,
    deliveryCharge: delivery,
    total,
    ...(advancePaid ? { advancePaid } : {}),
    paymentMethod: data.paymentMethod,
    paymentStatus: data.paymentMethod === "cod" ? (advancePaid ? "awaiting-verification" : "unpaid") : "awaiting-verification",
    paymentScreenshotUrl: screenshotUrl,
    courier: null,
    trackingNumber: null,
    notes: data.notes || null,
    history: [{ status: firstStatus, at: now.toISOString() }],
    confirmation,
    risk,
    userId: user && user.role === "customer" ? user.id : null,
  };

  const attemptRaw = str(fd, "attemptId");
  const attemptId = ATTEMPT_ID.test(attemptRaw) ? attemptRaw : null;
  const failed = async (message: string, extra: Partial<Extract<PlaceOrderState, { ok: false }>> = {}): Promise<PlaceOrderState> => {
    if (screenshotUrl) await deleteObject(screenshotUrl).catch((e) => log.error("checkout.screenshot_cleanup_failed", e));
    return { ok: false, message, ts, ...extra };
  };

  if (isCmsConfigured) {
    // Coupon use, stock, the order and its serial-numbered laptops in ONE transaction – all or nothing.
    const lines = [...aggregateQty(order)].map(([id, qty]) => ({ id, qty, title: order.items.find((i) => i.productId === id)?.name ?? "an item" }));
    let placed: Awaited<ReturnType<typeof placeOrderCms>> | null = null;
    for (let attempt = 0; attempt < 3 && !placed; attempt++) {
      try {
        placed = await placeOrderCms(order, lines, { attemptId, couponCode });
      } catch (err) {
        // a clashing order number (very rare) – try again with a new one
        if (/unique|duplicate key|invalid/i.test(String((err as Error)?.message)) && /order_number|orderNumber|Order number/i.test(String((err as Error)?.message)) && attempt < 2) {
          order.orderNumber = generateOrderNumber(now);
          continue;
        }
        log.error("checkout.save_failed", err, { order: order.orderNumber });
        return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
      }
    }
    if (!placed) return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
    if (!placed.ok) {
      if (placed.reason === "coupon") return failed(`The coupon ${couponCode} has just run out or expired. Remove it and place the order again.`, { couponError: "This coupon can't be used any more" });
      log.warn("checkout.sold_out", { items: placed.short });
      return failed(`Sorry – ${placed.short.join(", ")} just sold out. Please update your cart.`);
    }
    if (placed.duplicate) {
      // the same submit arrived twice (double click / retry) – show the order that was already placed
      if (screenshotUrl && screenshotUrl !== placed.order.paymentScreenshotUrl) await deleteObject(screenshotUrl).catch(() => undefined);
      await setOrderCookie(placed.order.orderNumber);
      return { ok: true, orderNumber: placed.order.orderNumber, total: placed.order.total, items: placed.order.items.map((i) => ({ id: i.productId, name: i.name, price: i.unitPrice, quantity: i.qty })), ts };
    }
    order.orderNumber = placed.order.orderNumber;
  } else {
    try {
      await insertOrder(order);
    } catch (err) {
      log.error("checkout.save_failed", err, { order: orderNumber });
      return failed("Something went wrong while placing your order. Please try again or order on WhatsApp.");
    }
  }
  rateLimitKey(`checkout-phone:${data.phone}`, 5, 60 * 60_000);

  // ── Best-effort side effects (never fail the order) ──
  let stockChanged = isCmsConfigured;
  for (const [productId, qty] of aggregateQty(order)) {
    try {
      if (isCmsConfigured) {
        continue; // already taken above
      } else {
        const p = await getOne("products", "id", productId);
        if (p) {
          await upsert("products", { ...p, stock: Math.max(0, p.stock - qty), soldCount: (p.soldCount ?? 0) + qty });
          stockChanged = true;
        }
      }
    } catch (err) {
      log.error("checkout.stock_update", err);
    }
  }
  if (couponCode && !isCmsConfigured) {
    try {
      const c = await getOne("coupons", "code", couponCode);
      if (c) await upsert("coupons", { ...c, used: (c.used ?? 0) + 1 });
    } catch (err) {
      log.error("checkout.coupon_usage", err);
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
            { id: randomUUID(), label: existing.length ? `Address ${existing.length + 1}` : "Home", name: data.name, phone: data.phone, city: data.city, address: data.address, landmark: data.landmark || undefined },
            ...existing,
          ],
          ...(profile?.phone ? {} : { phone: data.phone }),
        });
    } catch (err) {
      log.error("checkout.save_address", err);
    }
  }

  await setOrderCookie(order.orderNumber);

  // Notifications run after the response is sent; notify.ts never throws, the catch is a second guard.
  after(() => notifyNewOrder(order).catch((err) => log.error("checkout.notify", err)));
  // guest order → the customer with this email (or a new "no account yet" record) in /cms → Customers
  if (isCmsConfigured && !order.userId)
    after(() => linkOrderToCustomerCms(order.orderNumber, { email: order.customer.email, name: order.customer.name, phone: order.customer.phone }).catch((e) => log.error("checkout.customer_link_failed", e)));
  if (isCmsConfigured) after(() => closeDraftForOrder(order.customer.phone, order.customer.email ?? null, order.orderNumber).catch((e) => log.error("cart.draft_close_failed", e)));

  return {
    ok: true,
    orderNumber: order.orderNumber,
    total: order.total,
    items: order.items.map((i) => ({ id: i.productId, name: i.name, price: i.unitPrice, quantity: i.qty })),
    ts,
  };
}

function aggregateQty(order: Order) {
  const m = new Map<string, number>();
  for (const i of order.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
  return m;
}
