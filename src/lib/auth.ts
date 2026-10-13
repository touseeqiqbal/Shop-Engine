import "server-only";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { isCmsConfigured, isDatabaseConfigured } from "@/lib/db/config";
import {
  confirmEmailCms,
  createCustomerCms,
  claimGuestRecordCms,
  getUserByEmailCms,
  getUserCms,
  requestPasswordResetCms,
  resetPasswordCms,
  sendVerificationEmailCms,
  updateUserCms,
  type CmsRole,
} from "@/lib/cms/sales";
import { isEmailConfigured } from "@/lib/mailer";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SavedAddress } from "@/lib/types";
import { log } from "@/lib/log";

/**
 * Auth helpers used by pages and Server Actions.
 * - Database mode: Auth.js credentials (see src/auth.ts). Roles live in `users.role` ('customer' | 'staff' | 'admin').
 * - Demo mode (no DATABASE_URL): nobody can sign in (the account pages say accounts need a database).
 */

export type Role = "customer" | "staff" | "admin";
export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
}

const ROLES: Role[] = ["customer", "staff", "admin"];
const asRole = (r: string | null | undefined): Role => (ROLES.includes(r as Role) ? (r as Role) : "customer");
/** Payload roles → storefront roles (owner & manager = admin). */
const fromCmsRole = (r: CmsRole): Role => (r === "customer" ? "customer" : r === "staff" ? "staff" : "admin");

// ───────────────────────────── session ─────────────────────────────

/** Current signed-in user (customer or staff), or null. Role is always read fresh from the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured) return null;
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  if (isCmsConfigured) {
    const u = await getUserCms(id);
    if (!u || u.blocked) return null;
    // signed in before the last password reset → signed out (a stolen session ends when the password is reset)
    const issuedAt = (session?.user as { issuedAt?: number } | undefined)?.issuedAt;
    if (u.sessionsValidAfter && issuedAt && issuedAt * 1000 + 999 < Date.parse(u.sessionsValidAfter)) return null;
    return { id: u.id, email: u.email, name: u.name, role: fromCmsRole(u.role) };
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name ?? undefined, role: asRole(user.role) };
}

// ───────────────────────────── sign in / out / register (call from Server Actions) ─────────────────────────────

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!isDatabaseConfigured) return { ok: false, error: "Accounts need the store database." };
  try {
    await signIn("credentials", { email: normalized, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "Invalid email or password." };
    throw e;
  }
  if (isCmsConfigured) {
    const cu = await getUserByEmailCms(normalized);
    if (!cu) return { ok: false, error: "Invalid email or password." };
    return { ok: true, user: { id: cu.id, email: cu.email, name: cu.name, role: fromCmsRole(cu.role) } };
  }
  const u = await prisma.user.findUnique({ where: { email: normalized } });
  if (!u) return { ok: false, error: "Invalid email or password." };
  return { ok: true, user: { id: u.id, email: u.email, name: u.name ?? undefined, role: asRole(u.role) } };
}

export async function signOutUser() {
  if (isDatabaseConfigured) await signOut({ redirect: false });
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDatabaseConfigured) return { ok: false, error: "Customer accounts are available once the store database is connected." };
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (isCmsConfigured) {
    const existing = await getUserByEmailCms(email);
    // ordered before as a guest: the emailed "set your password" link proves the mailbox is theirs and turns the
    // record (with its order history) into their account – signing up alone must not hand over someone's orders
    if (existing && existing.role === "customer" && !existing.hasAccount) {
      // no email sending: nobody can prove the inbox, so the record becomes an account WITHOUT its old orders
      // (they reappear once this email is confirmed) – a guest order can't block anyone from signing up
      if (!isEmailConfigured()) {
        try {
          await claimGuestRecordCms(email, { name: input.name, phone: input.phone, password: input.password });
        } catch (err) {
          log.error("account.guest_record_claim", err);
          return { ok: false, error: "We couldn't create your account just now. Please try again in a minute." };
        }
        const res = await signInWithPassword(email, input.password);
        return res.ok ? { ok: true } : res;
      }
      try {
        await requestPasswordResetCms(email);
      } catch (err) {
        log.error("account.guest_set_password_email", err);
        return { ok: false, error: "You've ordered with us before with this email, but we couldn't send the set-password email just now. Please try again in a few minutes or contact us on WhatsApp." };
      }
      return { ok: false, error: "You've ordered with us before – we've emailed you a link to set your password. Open it to finish your account (check spam too)." };
    }
    if (existing) return { ok: false, error: "An account with this email already exists." };
    let created: Awaited<ReturnType<typeof createCustomerCms>>;
    try {
      created = await createCustomerCms({ email, name: input.name, phone: input.phone, password: input.password });
    } catch (err) {
      // e.g. a guest order with this email created its customer record at the same moment
      log.error("account.sign_up", err);
      return { ok: false, error: "We couldn't create your account just now. Please try again in a minute." };
    }
    void sendEmailConfirmation(created.id).catch((err) => log.error("account.confirmation_email", err));
    const res = await signInWithPassword(email, input.password);
    return res.ok ? { ok: true } : res;
  }
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "An account with this email already exists." };
  await prisma.user.create({
    data: { email, name: input.name.trim(), phone: input.phone?.trim() || null, passwordHash: await bcrypt.hash(input.password, 12), role: "customer" },
  });
  const res = await signInWithPassword(email, input.password);
  return res.ok ? { ok: true } : res;
}

// ───────────────────────────── forgot password & email confirmation ─────────────────────────────
// Only with the admin database (Payload): it holds the reset tokens and the "email confirmed" flag.

export async function requestPasswordReset(email: string) {
  if (isCmsConfigured) await requestPasswordResetCms(email);
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (!isCmsConfigured) return { ok: false, error: "Password reset needs the store database." };
  return resetPasswordCms(token, password);
}

export async function sendEmailConfirmation(userId: string): Promise<boolean> {
  return isCmsConfigured ? sendVerificationEmailCms(userId) : false;
}

export async function confirmEmail(token: string): Promise<"ok" | "expired" | "invalid"> {
  return isCmsConfigured ? confirmEmailCms(token) : "invalid";
}

// Email is the verification channel – only enforced once the shop can actually send email.

/** Checkout always needs an email (like Shopify): receipt, order updates, COD confirmation, the customer record in /cms. */
export const emailRequiredAtCheckout = () => isCmsConfigured;

/** A signed-in customer must confirm their account's email before ordering with the account (guests aren't affected). */
export async function mustConfirmEmailToOrder(user: SessionUser): Promise<boolean> {
  if (user.role !== "customer" || !isCmsConfigured || !isEmailConfigured()) return false;
  const u = await getUserCms(user.id);
  return Boolean(u && !u.emailVerified);
}

// ───────────────────────────── profile ─────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: Role;
  /** undefined when the store can't confirm emails (no admin database) */
  emailVerified?: boolean;
  addresses: SavedAddress[];
  wishlist: string[];
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isDatabaseConfigured) return null;
  if (isCmsConfigured) {
    const cu = await getUserCms(userId);
    return cu ? { id: cu.id, email: cu.email, name: cu.name, phone: cu.phone, role: fromCmsRole(cu.role), emailVerified: cu.emailVerified, addresses: cu.addresses, wishlist: cu.wishlist } : null;
  }
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? undefined,
    phone: u.phone ?? undefined,
    role: asRole(u.role),
    addresses: (u.addresses as unknown as SavedAddress[]) ?? [],
    wishlist: u.wishlist,
  };
}

export async function updateUserProfile(
  userId: string,
  patch: { name?: string; phone?: string; addresses?: SavedAddress[]; wishlist?: string[] }
) {
  if (!isDatabaseConfigured) return;
  if (isCmsConfigured) return updateUserCms(userId, patch);
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.addresses ? { addresses: patch.addresses as unknown as Prisma.InputJsonValue } : {}),
      ...(patch.wishlist ? { wishlist: patch.wishlist.slice(0, 200) } : {}),
    },
  });
}
