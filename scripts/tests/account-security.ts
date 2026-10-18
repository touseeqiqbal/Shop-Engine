/**
 * Account security on the real database:
 *  - a shopper's password reset works (it used to fail every time: Payload's reset runs the /cms 2-step hook), the new
 *    password signs in, the old one doesn't, the email counts as confirmed and earlier shop sessions end;
 *  - a store-team account WITH 2-step can reset its password too – and the reset still doesn't open /cms: signing in
 *    there needs the 2-step code;
 *  - owner actions outside /cms (Account → Stores) ask accounts with 2-step for a current code: none or a wrong one is
 *    refused, a right one works once, 5 wrong ones pause the codes; accounts without 2-step aren't asked;
 *  - nobody can set an account's legacyId through Payload (it is how the storefront finds old accounts), and a
 *    numeric storefront id finds only the account with that very id.
 * Creates its own accounts and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/account-security.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { byStorefrontId, resetPasswordCms } from "../../src/lib/cms/sales";
import { verifyStepUpCode } from "../../src/payload/endpoints/two-factor";
import { encrypt, totp } from "../../src/payload/two-factor";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true, skipRevalidate: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36);
const cleanup: (() => Promise<unknown>)[] = [];
const login = (email: string, password: string, context: Record<string, unknown> = {}) =>
  payload
    .login({ collection: "users", data: { email, password }, context } as never)
    .then(() => "ok")
    .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));

try {
  // ── a shopper resets their password ──
  const email = `reset-${tag}@test.local`;
  const shopper = (await payload.create({ collection: "users", data: { email, password: "Old-password-123!", name: "Reset Test", role: "customer" } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(shopper.id), overrideAccess: true }));
  const token = await payload.forgotPassword({ collection: "users", data: { email }, disableEmail: true, overrideAccess: true });
  const r = await resetPasswordCms(String(token), "New-password-456!");
  check(r.ok === true && r.staff === false, `a shopper's reset goes through (${JSON.stringify(r)})`);
  check((await login(email, "New-password-456!", { storefront: true })) === "ok", "the new password signs in on the shop");
  check((await login(email, "Old-password-123!", { storefront: true })) !== "ok", "the old one doesn't");
  const after = (await payload.findByID({ collection: "users", id: Number(shopper.id), depth: 0, overrideAccess: true, showHiddenFields: true })) as unknown as Doc;
  check(after.emailVerified === true && Boolean(after.sessionsValidAfter), "email counts as confirmed; earlier shop sessions end");
  check((await resetPasswordCms(String(token), "Again-password-789!")).ok === false, "the same link can't be used twice");
  const events = await payload.find({ collection: "security-events" as never, where: { and: [{ email: { equals: email } }, { kind: { equals: "sign-in" } }] } as never, limit: 5, depth: 0, overrideAccess: true });
  // one real sign-in (the new password; the old one failed) – the reset itself isn't one
  check(events.docs.length === 1, `the reset isn't recorded as a sign-in (${events.docs.length} sign-in recorded)`);
  cleanup.push(() => payload.delete({ collection: "security-events" as never, where: { email: { in: [email, `team-${tag}@test.local`] } } as never, overrideAccess: true }));

  // ── a store-team account with 2-step ──
  const teamEmail = `team-${tag}@test.local`;
  const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
  const team = (await payload.create({ collection: "users", data: { email: teamEmail, password: "Team-password-123!", name: "Team Test", role: "customer", currentStore: store } as never, ...sys })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(team.id), overrideAccess: true }));
  const membership = (await payload.create({ collection: "store-memberships", data: { store, user: team.id, email: teamEmail, role: "store_manager", status: "active" } as never, ...sys })) as unknown as Doc;
  cleanup.unshift(() => payload.delete({ collection: "store-memberships", id: Number(membership.id), overrideAccess: true, context: { system: true } }));
  // 2-step switched on (a test secret)
  const secret = "JBSWY3DPEHPK3PXP";
  await payload.update({ collection: "users", id: Number(team.id), data: { twoFactor: { enabled: true, secret: encrypt(secret), backupCodes: [] } } as never, ...sys });
  const teamToken = await payload.forgotPassword({ collection: "users", data: { email: teamEmail }, disableEmail: true, overrideAccess: true });
  const tr = await resetPasswordCms(String(teamToken), "Team-new-password-456!");
  // (a store's team are shop accounts with a membership – role "customer"; only platform accounts are "staff")
  check(tr.ok === true, `a 2-step team account can reset its password too (${JSON.stringify(tr)})`);
  const cms = await login(teamEmail, "Team-new-password-456!");
  check(/TWO_FACTOR_REQUIRED/.test(cms), `…and /cms still asks for the 2-step code (${cms})`);

  // ── owner actions outside /cms: the 2-step code ──
  check((await verifyStepUpCode(payload, Number(shopper.id), "")) === "not-enabled", "an account without 2-step isn't asked for a code");
  check((await verifyStepUpCode(payload, Number(team.id), "")) === "wrong", "with 2-step: no code → refused");
  check((await verifyStepUpCode(payload, Number(team.id), "000000")) === "wrong" || totp(secret) === "000000", "a wrong code → refused");
  const code = totp(secret);
  check((await verifyStepUpCode(payload, Number(team.id), code)) === "ok", "the current code → allowed");
  check((await verifyStepUpCode(payload, Number(team.id), code)) === "wrong", "…but only once (the same code again → refused)");
  // the next code used twice at the same moment: only one wins (one conditional statement each)
  await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 200)); // the next 30-second step
  const next = totp(secret);
  const both = await Promise.all([verifyStepUpCode(payload, Number(team.id), next), verifyStepUpCode(payload, Number(team.id), next)]);
  check(both.filter((r) => r === "ok").length === 1, `one code used twice at the same moment → only once (${both.join(", ")})`);
  for (let i = 0; i < 5; i++) await verifyStepUpCode(payload, Number(team.id), "123456");
  await new Promise((r) => setTimeout(r, 800)); // the wrong-code counter is written in the background
  check((await verifyStepUpCode(payload, Number(team.id), totp(secret))) === "locked", "after 5 wrong codes the codes are paused – even the right one");

  // ── legacyId can't be set through Payload; numeric ids find only their own account ──
  const T = { ...((await payload.findByID({ collection: "users", id: Number(team.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } } as never;
  await payload.update({ collection: "users", id: Number(team.id), data: { legacyId: String(shopper.id) } as never, user: T, overrideAccess: false, depth: 0 }).catch(() => null);
  const teamNow = (await payload.findByID({ collection: "users", id: Number(team.id), depth: 0, overrideAccess: true })) as unknown as Doc;
  check(!teamNow.legacyId, `an account can't give itself another account's id as legacyId (${String(teamNow.legacyId ?? "none")})`);
  // even if a legacyId like that existed (old data), a numeric storefront id finds only the account with that id
  await payload.update({ collection: "users", id: Number(team.id), data: { legacyId: String(shopper.id) } as never, ...sys });
  const found = await payload.find({ collection: "users", where: byStorefrontId(String(shopper.id)), limit: 5, depth: 0, overrideAccess: true });
  check(found.docs.length === 1 && Number((found.docs[0] as unknown as Doc).id) === Number(shopper.id), `storefront id ${String(shopper.id)} → only that account (${found.docs.map((d) => (d as unknown as Doc).id).join(", ")})`);
  await payload.update({ collection: "users", id: Number(team.id), data: { legacyId: null } as never, ...sys });

  // ── changing your OWN password in /cms is recorded (and the old address gets a notice) ──
  const changes = async () => (await payload.count({ collection: "security-events" as never, where: { and: [{ email: { equals: teamEmail } }, { kind: { equals: "password-changed" } }] } as never, overrideAccess: true })).totalDocs;
  const changes0 = await changes();
  const Tself = { ...((await payload.findByID({ collection: "users", id: Number(team.id), depth: 0, overrideAccess: true })) as object), collection: "users", twoFactor: { enabled: true } } as never;
  await payload.update({ collection: "users", id: Number(team.id), data: { password: "Team-changed-789!" } as never, user: Tself, overrideAccess: false, depth: 0 });
  check((await changes()) === changes0 + 1, `changing your own password in /cms is recorded as a security event (${changes0} → ${await changes()})`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const fn of cleanup) await fn().catch((e) => console.error("cleanup:", e instanceof Error ? e.message : e));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll account security checks passed");
process.exit(failed ? 1 : 0);
