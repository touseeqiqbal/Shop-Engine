/**
 * Platform operations on the real database:
 *  - security events: a wrong password and a good sign-in through /cms-api/2fa/login are recorded (address shortened);
 *  - a marketplace sync can't run twice at once (the per-connection claim), and records what it did;
 *  - cash paid out by the courier for every COD parcel of a delivered order marks the order Paid;
 *  - the platform's month-by-month history counts orders per currency;
 *  - a failed plan payment also queues an alert for ShopEngine's own team.
 * Creates its own records and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/platform-ops.ts
 */
import { randomBytes } from "node:crypto";
import { getPayload, createLocalReq, type PayloadRequest } from "payload";
import config from "@payload-config";
import { twoFactorEndpoints } from "../../src/payload/endpoints/two-factor";
import { claimSync, releaseSync, runSync, saveConnection, removeConnection, getConnection } from "../../src/lib/integrations/server";
import { markCodPaid } from "../../src/lib/integrations/couriers";
import { historyFor, platformEndpoints } from "../../src/payload/endpoints/platform";
import { resolveTenant } from "../../src/payload/tenancy";
import { storeDataEndpoints } from "../../src/payload/endpoints/store-data";
import { shortIp } from "../../src/lib/security-events";

const payload = await getPayload({ config });
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const cleanup: (() => Promise<unknown>)[] = [];

try {
  // ── security events ──
  check(shortIp("203.0.113.42") === "203.0.113.x" && shortIp("2001:db8:1:2:3::1") === "2001:db8:1:…", "network addresses are shortened");
  const email = `sec-${randomBytes(4).toString("hex")}@test.local`;
  const password = `Pw-${randomBytes(8).toString("hex")}!`;
  const user = (await payload.create({ collection: "users", data: { email, password, name: "Security Test", role: "customer" } as never, overrideAccess: true, depth: 0 })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(user.id), overrideAccess: true }));
  const login = twoFactorEndpoints.find((e) => e.path === "/2fa/login")!;
  const call = (body: unknown) => login.handler({ payload, headers: new Headers({ "x-forwarded-for": "198.51.100.77" }), json: async () => body, user: null, context: {} } as unknown as PayloadRequest) as Promise<Response>;
  const before = (await payload.count({ collection: "security-events" as never, where: { email: { equals: email } }, overrideAccess: true })).totalDocs;
  await call({ email, password: "wrong-password" });
  const failedEv = (await payload.find({ collection: "security-events" as never, where: { and: [{ email: { equals: email } }, { kind: { equals: "sign-in-failed" } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  check(Boolean(failedEv) && failedEv?.area === "admin", "wrong password at /cms is recorded");
  // a shopper account may not open /cms, but the password itself is right: Payload's login (and its hook) runs first
  await payload.login({ collection: "users", data: { email, password }, context: { storefront: true, clientIp: "198.51.100.77" } } as never);
  const ok = (await payload.find({ collection: "security-events" as never, where: { and: [{ email: { equals: email } }, { kind: { equals: "sign-in" } }] }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  check(Boolean(ok) && ok?.area === "shop" && ok?.ip === "198.51.100.x" && Number(ok?.userId) === Number(user.id), `a shop sign-in is recorded with the shortened address (${String(ok?.ip)})`);
  check((await payload.count({ collection: "security-events" as never, where: { email: { equals: email } }, overrideAccess: true })).totalDocs - before >= 2, "both events are there");
  cleanup.push(() => payload.delete({ collection: "security-events" as never, where: { email: { equals: email } }, overrideAccess: true }));

  // ── marketplace sync: one at a time ──
  const hadDaraz = await getConnection(payload, store, "daraz", { all: true, fresh: true });
  if (!hadDaraz) {
    const c = await saveConnection(payload, { storeId: store, provider: "daraz", enabled: true, config: {}, secrets: { accessToken: "x", refreshToken: "y" }, state: { country: "PK" }, status: "connected" });
    cleanup.push(() => removeConnection(payload, store, "daraz"));
    check((await claimSync(payload, c.id)) === true, "first sync claims the connection");
    check((await claimSync(payload, c.id)) === false, "a second sync at the same time is refused");
    await releaseSync(payload, c.id);
    check((await claimSync(payload, c.id)) === true, "after it ends, the next sync can run");
    await releaseSync(payload, c.id);
    const r = await runSync(payload, c, async () => "2 Daraz order(s) taken off stock");
    const after = await getConnection(payload, store, "daraz", { all: true, fresh: true });
    check(r.ran && after?.state.lastSync === "2 Daraz order(s) taken off stock" && typeof after?.state.lastSyncAt === "string" && after?.state.syncLockUntil === undefined, "a sync records what it did and lets go of the claim");
    const bad = await runSync(payload, c, async () => {
      throw new Error("Daraz said no");
    });
    check(bad.error === "Daraz said no", "a failing sync is recorded as failed");
  } else console.log("- skipped sync claim test (the store already has Daraz connected)");

  // ── courier cash → order paid ──
  const order = (await payload.create({
    collection: "orders",
    data: {
      store,
      orderNumber: `COD-${Date.now().toString(36).toUpperCase()}`,
      placedAt: new Date().toISOString(),
      status: "delivered",
      customer: { name: "COD Test", phone: "0300-1112223", city: "Karachi", address: "Street 1" },
      items: [{ title: "Mouse", qty: 1, unitPrice: 1000 }],
      subtotal: 1000,
      total: 1000,
      paymentMethod: "cod",
      paymentDue: "on-delivery",
      paymentStatus: "unpaid",
      shipments: [
        { courier: "PostEx", trackingNumber: "T1", status: "delivered", provider: "postex", codAmount: 600, codStatus: "remitted", codRemittanceRef: "CPR-1" },
        { courier: "PostEx", trackingNumber: "T2", status: "delivered", provider: "postex", codAmount: 400, codStatus: "pending" },
      ],
    } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "orders", id: Number(order.id), overrideAccess: true, context: { migrating: true, skipStock: true } }));
  check((await markCodPaid(payload, Number(order.id), "PostEx")) === false, "one parcel's cash still to come → not paid yet");
  const ships = ((await payload.findByID({ collection: "orders", id: Number(order.id), depth: 0, overrideAccess: true })) as unknown as { shipments: Doc[] }).shipments;
  ships[1] = { ...ships[1], codStatus: "remitted", codRemittanceRef: "CPR-2" };
  await payload.update({ collection: "orders", id: Number(order.id), data: { shipments: ships } as never, overrideAccess: true, context: { system: true } });
  check((await markCodPaid(payload, Number(order.id), "PostEx")) === true, "all cash paid out → marked paid");
  const paid = (await payload.findByID({ collection: "orders", id: Number(order.id), depth: 0, overrideAccess: true })) as unknown as Doc & { history?: { note?: string }[] };
  check(paid.paymentStatus === "paid" && (paid.history ?? []).some((h) => String(h.note ?? "").includes("CPR-1, CPR-2")), `order Paid with the payout references (${String(paid.paymentStatus)})`);

  // ── platform history ──
  const req = await createLocalReq({}, payload);
  const h = await historyFor(req, 3);
  const thisMonth = h[h.length - 1];
  check(h.length === 3 && thisMonth.month === new Date().toISOString().slice(0, 7), "history has the last 3 months, this one last");
  check(thisMonth.orders >= 1 && (thisMonth.orderValue.PKR ?? 0) >= 1000, `this month's orders are counted (${thisMonth.orders}, PKR ${thisMonth.orderValue.PKR ?? 0})`);

  // ── support "view as" ──
  const adminEmail = `support-${randomBytes(4).toString("hex")}@test.local`;
  const admin = (await payload.create({ collection: "users", data: { email: adminEmail, password: `Pw-${randomBytes(8).toString("hex")}!`, name: "Support Test", role: "customer", platformRole: "platform_admin", twoFactor: { enabled: true } } as never, overrideAccess: true, depth: 0, context: { twoFactorUpdate: true } })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "users", id: Number(admin.id), overrideAccess: true }));
  const adminUser = { ...admin, collection: "users", twoFactor: { enabled: true } };
  const ep = (path: string) => platformEndpoints.find((e) => e.path === path)!;
  const asAdmin = (body: unknown) => ({ payload, user: adminUser, headers: new Headers(), json: async () => body, context: {} }) as unknown as PayloadRequest;
  let res = (await ep("/platform/view-as").handler(asAdmin({ storeId: store, role: "store_staff", reason: "x" }))) as Response;
  check(res.status === 400, "a reason is required");
  res = (await ep("/platform/view-as").handler(asAdmin({ storeId: store, role: "store_staff", reason: "support request #42" }))) as Response;
  check(res.status === 200, "support view starts");
  const viewing = await resolveTenant(payload, (await payload.findByID({ collection: "users", id: Number(admin.id), depth: 0, overrideAccess: true })) as never);
  const fresh = { ...((await payload.findByID({ collection: "users", id: Number(admin.id), depth: 0, overrideAccess: true })) as unknown as Doc), collection: "users", twoFactor: { enabled: true } };
  const t1 = await resolveTenant(payload, fresh as never);
  check(viewing !== null && !t1.platformAdmin && t1.roles.get(store) === "store_staff" && t1.roles.size === 1 && t1.activeStoreId === store && t1.viewingAs?.role === "store_staff", "meanwhile: only staff rights in that one store, no platform rights");
  const logged = await payload.count({ collection: "security-events" as never, where: { and: [{ kind: { equals: "support-view" } }, { email: { equals: adminEmail } }] }, overrideAccess: true });
  check(logged.totalDocs === 1, "recorded in security events");
  cleanup.push(() => payload.delete({ collection: "security-events" as never, where: { email: { equals: adminEmail } }, overrideAccess: true }));
  res = (await ep("/platform/view-as/stop").handler(asAdmin({}))) as Response;
  const back = { ...((await payload.findByID({ collection: "users", id: Number(admin.id), depth: 0, overrideAccess: true })) as unknown as Doc), collection: "users", twoFactor: { enabled: true } };
  const t2 = await resolveTenant(payload, back as never);
  check(res.status === 200 && t2.platformAdmin && !t2.viewingAs, "stopping gives the platform rights back");
  const expired = await resolveTenant(payload, { ...back, supportView: { store, role: "store_owner", until: new Date(Date.now() - 1000).toISOString() } } as never);
  check(expired.platformAdmin && !expired.viewingAs, "an expired support view ends by itself");

  // ── a store owner's data export and closing the store ──
  const slug = `close-test-${randomBytes(3).toString("hex")}`;
  const temp = (await payload.create({ collection: "stores", data: { name: "Close Test Store", slug, subdomain: slug, status: "active" } as never, overrideAccess: true, depth: 0, context: { migrating: true } })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "stores", id: Number(temp.id), overrideAccess: true }));
  const cat = (await payload.create({ collection: "categories", data: { name: "Temp", slug: `temp-${slug}`, store: temp.id } as never, overrideAccess: true, depth: 0, context: { migrating: true } })) as unknown as Doc;
  cleanup.push(() => payload.delete({ collection: "categories", id: Number(cat.id), overrideAccess: true }));
  const ownerReq = (body: unknown = {}) =>
    ({ payload, user: { id: Number(user.id), collection: "users", email: "owner@test.local" }, headers: new Headers(), json: async () => body, method: "POST", context: { __shopengineTenant: { userId: Number(user.id), tenant: { userId: Number(user.id), platformAdmin: false, roles: new Map([[Number(temp.id), "store_owner"]]), activeStoreId: Number(temp.id), defaultStoreId: store, readOnly: new Set() } } } }) as unknown as PayloadRequest;
  const sd = (path: string) => storeDataEndpoints.find((e) => e.path === path)!;
  let r = (await sd("/store-data/export").handler(ownerReq())) as Response;
  const dump = JSON.parse(await r.text()) as { format?: string; collections?: Record<string, Doc[]>; store?: Doc };
  check(r.status === 200 && dump.format === "shopengine-store-data/1" && dump.collections?.categories?.some((c) => c.slug === `temp-${slug}`) === true, "the owner downloads all of the store's data");
  check(!JSON.stringify(dump).includes('"secrets"') && !JSON.stringify(dump).includes('"hash"'), "no keys or hashes in the file");
  const staffReq = { ...ownerReq(), context: { __shopengineTenant: { userId: Number(user.id), tenant: { userId: Number(user.id), platformAdmin: false, roles: new Map([[Number(temp.id), "store_staff"]]), activeStoreId: Number(temp.id), defaultStoreId: store, readOnly: new Set() } } } } as unknown as PayloadRequest;
  r = (await sd("/store-data/export").handler(staffReq)) as Response;
  check(r.status === 403, "staff can't download everything");
  r = (await sd("/store-data/close").handler(ownerReq({ confirm: "wrong name" }))) as Response;
  check(r.status === 400, "closing needs the store's name typed");
  r = (await sd("/store-data/close").handler(ownerReq({ confirm: "Close Test Store" }))) as Response;
  const closed = (await payload.findByID({ collection: "stores", id: Number(temp.id), depth: 0, overrideAccess: true })) as unknown as Doc;
  check(r.status === 200 && closed.status === "closed", "the owner closes the store (offline, data kept)");
  const alert = await payload.count({ collection: "outbox-events" as never, where: { dedupeKey: { like: `store-closed:${String(temp.id)}:` } } as never, overrideAccess: true });
  check(alert.totalDocs === 1, "ShopEngine's team is told");
  cleanup.push(() => payload.delete({ collection: "outbox-events" as never, where: { dedupeKey: { like: `store-closed:${String(temp.id)}:` } } as never, overrideAccess: true }));

  // ── platform alert for a failed plan payment ──
  const { queueNotification } = await import("../../src/lib/notify");
  const key = `platform-alert:test:${Date.now()}`;
  await queueNotification(payload, "platform", null, { subject: "Test store: plan payment failed", lines: ["test"] }, { dedupeKey: key });
  const queued = (await payload.find({ collection: "outbox-events" as never, where: { dedupeKey: { equals: key } } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  check(queued?.type === "notify.platform", "a platform alert is queued for ShopEngine's team");
  if (queued) cleanup.push(() => payload.delete({ collection: "outbox-events" as never, id: Number(queued.id), overrideAccess: true }));
} finally {
  for (const c of cleanup.reverse()) await c().catch((e) => console.warn(`cleanup: ${(e as Error).message}`));
}
console.log(failed ? `Platform operations FAILED (${failed})` : "Platform operations passed");
process.exit(failed ? 1 : 0);
