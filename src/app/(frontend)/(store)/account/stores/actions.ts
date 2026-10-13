"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { acceptStoreInvitation, createStoreForUser, publishStore } from "@/lib/store-tenant";

export type StoreFormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  storeId?: string;
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

export async function createStoreAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to create your store." };

  const parsed = createStoreSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    slug: String(fd.get("slug") ?? ""),
    businessName: String(fd.get("businessName") ?? ""),
    country: String(fd.get("country") ?? ""),
    currency: String(fd.get("currency") ?? ""),
    timezone: String(fd.get("timezone") ?? ""),
    defaultLanguage: String(fd.get("defaultLanguage") ?? ""),
    subdomain: String(fd.get("subdomain") ?? ""),
    planId: String(fd.get("planId") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "We could not validate the store details." };
  }

  const res = await createStoreForUser(user.id, parsed.data);
  return res.ok ? { ok: true, message: "Store created and ready for setup.", storeId: res.storeId, ts: Date.now() } : { ok: false, error: res.error, ts: Date.now() };
}

export async function acceptInvitationAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const membershipId = String(fd.get("membershipId") ?? "").trim();
  if (!membershipId) return { ok: false, error: "The invitation is missing." };

  const res = await acceptStoreInvitation(user.id, membershipId);
  return res.ok ? { ok: true, message: "Invitation accepted. The store is now available in your account.", ts: Date.now() } : { ok: false, error: res.error, ts: Date.now() };
}

export async function publishStoreAction(_prev: StoreFormState, fd: FormData): Promise<StoreFormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const storeId = String(fd.get("storeId") ?? "").trim();
  if (!storeId) return { ok: false, error: "Store ID is missing." };

  const res = await publishStore(user.id, storeId);
  return res.ok ? { ok: true, message: "Store published and is now active.", ts: Date.now() } : { ok: false, error: res.error, ts: Date.now() };
}
