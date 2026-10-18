/**
 * A temporary owner of the default store for the /cms screen check (scripts/tests/admin-smoke.mjs) – LOCAL test
 * databases only. Needs ADMIN_SMOKE=1, a database on localhost and ADMIN_SMOKE_PASSWORD (use a random one per run).
 * REMOVE=1 deletes the account again.
 *
 *   ADMIN_SMOKE=1 ADMIN_SMOKE_PASSWORD=… node --conditions=react-server node_modules/payload/bin.js run scripts/tests/admin-smoke-user.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";

const url = process.env.DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
if (process.env.ADMIN_SMOKE !== "1" || !local) {
  console.error("Refused: set ADMIN_SMOKE=1 and use a local test database.");
  process.exit(1);
}
const password = process.env.ADMIN_SMOKE_PASSWORD ?? "";
if (process.env.REMOVE !== "1" && password.length < 16) {
  console.error("Set ADMIN_SMOKE_PASSWORD (16+ characters).");
  process.exit(1);
}
const payload = await getPayload({ config });
type Doc = Record<string, unknown>;
const email = "admin.smoke@test.local";
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const existing = (await payload.find({ collection: "users", where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;

if (process.env.REMOVE === "1") {
  if (existing) {
    await payload.delete({ collection: "store-memberships", where: { user: { equals: Number(existing.id) } } as never, overrideAccess: true, context: { system: true } });
    await payload.delete({ collection: "users", id: Number(existing.id), overrideAccess: true });
  }
  console.log("admin smoke user removed");
  process.exit(0);
}

const user = existing
  ? ((await payload.update({ collection: "users", id: Number(existing.id), data: { password, currentStore: store } as never, overrideAccess: true, depth: 0 })) as unknown as Doc)
  : ((await payload.create({ collection: "users", data: { email, password, name: "Admin Smoke", role: "customer", platformRole: "merchant_owner", currentStore: store, emailVerified: true } as never, overrideAccess: true, depth: 0 })) as unknown as Doc);
const member = (await payload.find({ collection: "store-memberships", where: { and: [{ user: { equals: Number(user.id) } }, { store: { equals: store } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
if (!member) await payload.create({ collection: "store-memberships", data: { store, user: user.id, email, role: "store_owner", status: "active" } as never, overrideAccess: true, depth: 0, context: { system: true } });
console.log(`admin smoke user ready: ${email} (owner of store ${store})`);
process.exit(0);
