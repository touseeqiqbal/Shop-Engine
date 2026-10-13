"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getSessionUser,
  getUserProfile,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  sendEmailConfirmation,
  signInWithPassword,
  signOutUser,
  updateUserProfile,
} from "@/lib/auth";
import { PAKISTAN_CITIES } from "@/lib/cities";
import { isDatabaseConfigured } from "@/lib/db/config";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { canSendOrderLookup, notifyOrderLookup } from "@/lib/notify";
import { listOrdersByPhone } from "@/lib/repo/orders";
import type { SavedAddress } from "@/lib/types";
import { normalizePkPhone } from "@/lib/utils";
import { safePath } from "@/lib/safe-path";
import { HONEYPOT } from "@/lib/honeypot";
import { log } from "@/lib/log";

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string>; ts?: number };

const safeNext = (v: FormDataEntryValue | null) => {
  const s = safePath(v, "/account");
  return s.startsWith("/admin") || s.startsWith("/cms") ? "/account" : s;
};

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "");
    if (k && !out[k]) out[k] = i.message;
  }
  return out;
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address").max(120),
  password: z.string().min(1, "Enter your password").max(200),
});

export async function loginAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  if (!isDatabaseConfigured) return { error: "Customer accounts activate once the store database is connected.", ts: Date.now() };
  const parsed = loginSchema.safeParse({ email: String(fd.get("email") ?? "").trim().toLowerCase(), password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { fieldErrors: issuesToFields(parsed.error.issues), ts: Date.now() };
  if (!(await rateLimit("customer-login", 10, 10 * 60_000))) return { error: "Too many attempts – please wait a few minutes.", ts: Date.now() };
  const res = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: res.error || "Incorrect email or password.", ts: Date.now() };
  redirect(safeNext(fd.get("next")));
}

const registerSchema = z.object({
  name: z.string().trim().min(3, "Please enter your full name").max(80),
  email: z.email("Enter a valid email address").max(120),
  phone: z.string().refine((v) => v === "" || !!normalizePkPhone(v), "Enter a valid mobile number, e.g. 0300-1234567"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function registerAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  if (!isDatabaseConfigured) return { error: "Customer accounts activate once the store database is connected.", ts: Date.now() };
  if (fd.get(HONEYPOT)) return { error: "Could not create account.", ts: Date.now() };
  const parsed = registerSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    phone: String(fd.get("phone") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: issuesToFields(parsed.error.issues), ts: Date.now() };
  if (!(await rateLimit("customer-register", 5, 30 * 60_000))) return { error: "Too many sign-ups from your network – please try later.", ts: Date.now() };
  const phone = parsed.data.phone ? normalizePkPhone(parsed.data.phone)! : undefined;
  const res = await registerCustomer({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password, phone });
  if (!res.ok) return { error: res.error || "Could not create your account.", ts: Date.now() };
  redirect(safeNext(fd.get("next")));
}

export type ForgotState = { error?: string; sent?: boolean; ts?: number };

/** Always answers the same way whether or not the email has an account (no account probing). */
export async function forgotPasswordAction(_prev: ForgotState, fd: FormData): Promise<ForgotState> {
  if (!isDatabaseConfigured) return { error: "Customer accounts activate once the store database is connected.", ts: Date.now() };
  const email = z.email().max(120).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address.", ts: Date.now() };
  if (!(await rateLimit("forgot-password", 5, 30 * 60_000))) return { error: "Too many requests – please wait a few minutes.", ts: Date.now() };
  try {
    await requestPasswordReset(email.data);
  } catch (err) {
    log.error("account.forgot_password", err);
    return { error: "We couldn't send the email right now. Please try again, or WhatsApp us for help.", ts: Date.now() };
  }
  return { sent: true, ts: Date.now() };
}

const resetSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "The two passwords don't match" });

export async function resetPasswordAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  if (!isDatabaseConfigured) return { error: "Customer accounts activate once the store database is connected.", ts: Date.now() };
  const parsed = resetSchema.safeParse({ token: String(fd.get("token") ?? ""), password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  if (!parsed.success) {
    const fieldErrors = issuesToFields(parsed.error.issues);
    return fieldErrors.token ? { error: "This reset link is incomplete – please open the link from the email again.", ts: Date.now() } : { fieldErrors, ts: Date.now() };
  }
  if (!(await rateLimit("reset-password", 10, 30 * 60_000))) return { error: "Too many attempts – please wait a few minutes.", ts: Date.now() };
  const res = await resetPassword(parsed.data.token, parsed.data.password);
  if (!res.ok) return { error: res.error, ts: Date.now() };
  const login = await signInWithPassword(res.email, parsed.data.password);
  redirect(login.ok ? "/account?reset=1" : "/account/login?reset=1");
}

/** "Resend confirmation email" on the account page. */
export async function resendConfirmationAction(): Promise<{ ok: boolean; message: string }> {
  const userId = await requireCustomerId();
  if (!userId) return { ok: false, message: "Please sign in again." };
  if (!(await rateLimit("resend-confirmation", 3, 30 * 60_000))) return { ok: false, message: "Already sent – please check your inbox and spam folder, or try again in a while." };
  try {
    const sent = await sendEmailConfirmation(userId);
    return sent ? { ok: true, message: "Sent! Check your inbox (and the spam folder)." } : { ok: false, message: "We couldn't send emails right now – please try again later." };
  } catch (err) {
    log.error("account.resend_confirmation", err);
    return { ok: false, message: "We couldn't send the email right now – please try again later." };
  }
}

export async function logoutAction() {
  await signOutUser();
  redirect("/account/login");
}

async function requireCustomerId() {
  if (!isDatabaseConfigured) return null;
  const user = await getSessionUser().catch(() => null);
  return user?.id ?? null;
}

const addressSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1, "Label required").max(30),
  name: z.string().trim().min(3, "Name required").max(80),
  phone: z.string().refine((v) => !!normalizePkPhone(v), "Invalid mobile number"),
  city: z.string().refine((c) => PAKISTAN_CITIES.includes(c), "Choose a city from the list"),
  address: z.string().trim().min(10, "Complete address required").max(300),
  landmark: z.string().trim().max(120).optional(),
});

/** Replaces the signed-in customer's saved addresses (max 10). */
export async function saveAddressesAction(addresses: SavedAddress[]): Promise<{ ok: boolean; error?: string; addresses?: SavedAddress[] }> {
  const userId = await requireCustomerId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const parsed = z.array(addressSchema).max(10).safeParse(addresses);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" };
  const clean = parsed.data.map((a) => ({ ...a, phone: normalizePkPhone(a.phone)!, landmark: a.landmark || undefined })) as SavedAddress[];
  try {
    await updateUserProfile(userId, { addresses: clean });
    return { ok: true, addresses: clean };
  } catch (err) {
    log.error("account.save_addresses", err);
    return { ok: false, error: "Couldn't save – please try again." };
  }
}

/** Merges the local wishlist into the signed-in customer's profile and returns the merged list. */
export async function syncWishlistAction(localIds: string[]): Promise<string[] | null> {
  const userId = await requireCustomerId();
  if (!userId) return null;
  const ids = z.array(z.string().max(120)).max(200).safeParse(localIds);
  if (!ids.success) return null;
  try {
    const profile = await getUserProfile(userId);
    const remote: string[] = Array.isArray(profile?.wishlist) ? profile.wishlist : [];
    const merged = [...new Set([...ids.data, ...remote])].slice(0, 200);
    if (merged.length !== remote.length || merged.some((id, i) => id !== remote[i])) await updateUserProfile(userId, { wishlist: merged });
    return merged;
  } catch (err) {
    log.error("account.wishlist_sync", err);
    return null;
  }
}

/** Replaces the profile wishlist (after a removal on the wishlist page). */
export async function setWishlistAction(ids: string[]): Promise<void> {
  const userId = await requireCustomerId();
  if (!userId) return;
  const parsed = z.array(z.string().max(120)).max(200).safeParse(ids);
  if (!parsed.success) return;
  await updateUserProfile(userId, { wishlist: parsed.data }).catch((err) => log.error("account.wishlist_set", err));
}

export type FindOrdersState = { status: "idle" } | { status: "error"; message: string; ts: number } | { status: "sent"; byMessage: boolean; ts: number };

/**
 * "Find my orders": the order numbers are sent to that phone (WhatsApp / SMS) and to the email used on those orders –
 * never shown on screen, so typing
 * someone else's number reveals nothing. The answer is the same whether or not the number has orders.
 */
export async function findOrdersByPhoneAction(_prev: FindOrdersState, fd: FormData): Promise<FindOrdersState> {
  const ts = Date.now();
  const phone = normalizePkPhone(String(fd.get("phone") ?? ""));
  if (!phone) return { status: "error", message: "Enter a valid mobile number, e.g. 0300-1234567", ts };
  if (!(await rateLimit("find-orders", 8, 10 * 60_000))) return { status: "error", message: "Too many lookups – please wait a few minutes.", ts };
  if (!canSendOrderLookup()) return { status: "sent", byMessage: false, ts };
  // At most 3 messages a day to one number, whoever asks.
  if (rateLimitKey(`find-orders-phone:${phone}`, 3, 24 * 60 * 60_000)) {
    after(async () => {
      const orders = await listOrdersByPhone(phone).catch(() => []);
      if (orders.length) await notifyOrderLookup(phone, orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => ({ orderNumber: o.orderNumber, email: o.customer.email })));
    });
  }
  return { status: "sent", byMessage: true, ts };
}
