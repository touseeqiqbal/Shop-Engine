"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import {
  acceptStoreInvitation,
  cancelStorePlanForUser,
  createStoreForUser,
  paymentsLinkForUser,
  publishStore,
  refreshPaymentsForUser,
  setCustomDomainForUser,
  setStorePlanForUser,
  verifyCustomDomainForUser,
} from "@/lib/store-tenant";

export type StoreFormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  storeId?: string;
  /** a page to open next (plan payment, payment-account setup) */
  redirectUrl?: string;
  ts?: number;
};

const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Store name is required").max(120),
  slug: z.string().trim().max(48).optional(),
  businessName: z.string().trim().max(120).optional(),
  country: z.string().trim().max(60).optional(),
  currency: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(60).optional(),
  defaultLanguage: z.string().trim().max(10).optional(),
  subdomain: z.string().trim().max(48).optional(),
  planId: z.string().trim().max(64).optional().or(z.literal("")),
});

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const done = (r: { ok: true } | { ok: false; error: string }, message: string, extra: Partial<StoreFormState> = {}): StoreFormState => {
  if (r.ok) revalidatePath("/account/stores");
  return r.ok ? { ok: true, message, ts: Date.now(), ...extra } : { ok: false, error: r.error, ts: Date.now() };
};

export async function createStoreAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to create your store." };
  if (!(await verifyTurnstile(fd, "create-store"))) return { ok: false, error: BOT_MESSAGE };

  const parsed = createStoreSchema.safeParse({
    name: field(fd, "name"),
    slug: field(fd, "slug"),
    businessName: field(fd, "businessName"),
    country: field(fd, "country"),
    currency: field(fd, "currency"),
    timezone: field(fd, "timezone"),
    defaultLanguage: field(fd, "defaultLanguage"),
    subdomain: field(fd, "subdomain"),
    planId: field(fd, "planId"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "We could not validate the store details." };

  const res = await createStoreForUser(user.id, parsed.data);
  if (!res.ok) return { ok: false, error: res.error, ts: Date.now() };
  revalidatePath("/account/stores");
  return {
    ok: true,
    message: res.checkoutUrl ? "Store created – opening the payment page for your plan…" : "Store created. Add your products in /cms, then publish it here.",
    storeId: res.storeId,
    ...(res.checkoutUrl ? { redirectUrl: res.checkoutUrl } : {}),
    ts: Date.now(),
  };
}

export async function acceptInvitationAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const membershipId = field(fd, "membershipId");
  const token = field(fd, "token");
  if (!membershipId && !token) return { ok: false, error: "The invitation is missing." };
  const res = await acceptStoreInvitation(user.id, { membershipId: membershipId || undefined, token: token || undefined });
  return done(res, "Invitation accepted. Open /cms to start working in the store.");
}

export async function publishStoreAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const storeId = field(fd, "storeId");
  if (!storeId) return { ok: false, error: "Store ID is missing." };
  return done(await publishStore(user.id, storeId), "Your store is live.");
}

export async function changePlanAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const cycle = field(fd, "cycle") === "annual" ? "annual" : "monthly";
  const res = await setStorePlanForUser(user.id, field(fd, "storeId"), field(fd, "planId"), cycle);
  if (!res.ok) return { ok: false, error: res.error, ts: Date.now() };
  revalidatePath("/account/stores");
  return res.checkoutUrl ? { ok: true, message: "Opening the payment page…", redirectUrl: res.checkoutUrl, ts: Date.now() } : { ok: true, message: "Plan updated.", ts: Date.now() };
}

export async function cancelPlanAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  return done(await cancelStorePlanForUser(user.id, field(fd, "storeId")), "The plan ends at the end of the paid period.");
}

export async function connectPaymentsAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const res = await paymentsLinkForUser(user.id, field(fd, "storeId"));
  return res.ok ? { ok: true, message: "Opening the payment account setup…", redirectUrl: res.url, ts: Date.now() } : { ok: false, error: res.error, ts: Date.now() };
}

export async function refreshPaymentsAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const res = await refreshPaymentsForUser(user.id, field(fd, "storeId"));
  if (!res.ok) return { ok: false, error: res.error, ts: Date.now() };
  revalidatePath("/account/stores");
  return { ok: true, message: res.ready ? "Card payments are ready – turn them on in /cms → Settings → Payments." : "The payment provider hasn't finished checking the account yet.", ts: Date.now() };
}

export async function setDomainAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  return done(await setCustomDomainForUser(user.id, field(fd, "storeId"), field(fd, "domain")), "Domain saved. Add the TXT record shown, then press Verify.");
}

export async function verifyDomainAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const res = await verifyCustomDomainForUser(user.id, field(fd, "storeId"));
  if (!res.ok) return { ok: false, error: res.error, ts: Date.now() };
  revalidatePath("/account/stores");
  return res.verified ? { ok: true, message: "Domain verified – your store now answers on it.", ts: Date.now() } : { ok: false, error: "The TXT record wasn't found yet. DNS changes can take up to an hour.", ts: Date.now() };
}
