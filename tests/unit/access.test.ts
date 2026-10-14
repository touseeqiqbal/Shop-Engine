import { beforeEach, describe, expect, it } from "vitest";
import type { Payload, PayloadRequest } from "payload";
import { needsTwoFactorSetup, usersDelete, usersRead, usersUpdate } from "@/payload/access";
import {
  adminSeat,
  assignStore,
  createFor,
  forgetDefaultStore,
  isPlatformAdminUser,
  publicOrStore,
  readFor,
  resolveTenant,
  storeIdOf,
  storeScope,
  writeFor,
  type Tenant,
  type TenantUser,
} from "@/payload/tenancy";
import { diff } from "@/payload/collections/history";

/* ───────────── a tiny in-memory "payload" for the lookups tenancy makes ───────────── */

type Row = Record<string, unknown>;
function fakePayload(data: { stores: Row[]; memberships: Row[] }): Payload {
  const matches = (row: Row, where: Row | undefined): boolean => {
    if (!where) return true;
    if (Array.isArray(where.and)) return (where.and as Row[]).every((w) => matches(row, w));
    if (Array.isArray(where.or)) return (where.or as Row[]).some((w) => matches(row, w));
    return Object.entries(where).every(([field, cond]) => {
      const c = cond as Row;
      const v = row[field];
      if ("equals" in c) return v === c.equals || String(v) === String(c.equals);
      if ("in" in c) return (c.in as unknown[]).map(String).includes(String(v));
      return true;
    });
  };
  return {
    find: async ({ collection, where }: { collection: string; where?: Row }) => {
      const rows = collection === "stores" ? data.stores : collection === "store-memberships" ? data.memberships : [];
      const docs = rows.filter((r) => matches(r, where));
      return { docs, totalDocs: docs.length };
    },
  } as unknown as Payload;
}

const STORES = [
  { id: 1, isDefault: true, status: "active", subscriptionStatus: "active" },
  { id: 2, isDefault: false, status: "active", subscriptionStatus: "trialing" },
  { id: 3, isDefault: false, status: "suspended", subscriptionStatus: "active" },
];
const user = (u: Partial<TenantUser> & { id: number }, tfa = true): TenantUser => ({ collection: "users", twoFactor: { enabled: tfa }, ...u });

beforeEach(() => forgetDefaultStore());

describe("platform admin", () => {
  it("is the legacy owner or platformRole platform_admin – only with 2-step on", () => {
    expect(isPlatformAdminUser(user({ id: 1, role: "owner" }))).toBe(true);
    expect(isPlatformAdminUser(user({ id: 1, role: "owner" }, false))).toBe(false);
    expect(isPlatformAdminUser(user({ id: 1, role: "customer", platformRole: "platform_admin" }))).toBe(true);
  });
  it("a merchant (self-serve store owner) is NOT a platform admin", () => {
    expect(isPlatformAdminUser(user({ id: 7, role: "customer", platformRole: "merchant_owner" }))).toBe(false);
    expect(isPlatformAdminUser(user({ id: 7, role: "manager" }))).toBe(false);
  });
});

describe("store roles come only from active memberships", () => {
  const payload = fakePayload({
    stores: STORES,
    memberships: [
      { id: 1, user: 7, store: 2, role: "store_owner", status: "active" },
      { id: 2, user: 8, store: 2, role: "store_manager", status: "invited" },
      { id: 3, user: 9, store: 2, role: "store_manager", status: "active" },
      { id: 4, user: 10, store: 3, role: "store_staff", status: "active" },
    ],
  });

  it("an owner works in their own store only", async () => {
    const t = await resolveTenant(payload, user({ id: 7, role: "customer", platformRole: "merchant_owner" }));
    expect(t.platformAdmin).toBe(false);
    expect([...t.roles]).toEqual([[2, "store_owner"]]);
    expect(t.activeStoreId).toBe(2);
  });
  it("an invitation gives nothing until it is accepted", async () => {
    const t = await resolveTenant(payload, user({ id: 8, role: "customer" }));
    expect(t.roles.size).toBe(0);
    expect(t.activeStoreId).toBeNull();
  });
  it("owners / managers count only with 2-step on", async () => {
    expect((await resolveTenant(payload, user({ id: 9, role: "customer" }, false))).roles.size).toBe(0);
    expect((await resolveTenant(payload, user({ id: 9, role: "customer" }, true))).roles.get(2)).toBe("store_manager");
  });
  it("currentStore can't point at a store the person isn't in", async () => {
    const t = await resolveTenant(payload, user({ id: 7, role: "customer", currentStore: 1 }));
    expect(t.activeStoreId).toBe(2);
  });
  it("the original shop's team (legacy roles) works in the default store", async () => {
    const t = await resolveTenant(payload, user({ id: 20, role: "manager" }));
    expect(t.roles.get(1)).toBe("store_manager");
    expect(t.platformAdmin).toBe(false);
  });
  it("a suspended store is read-only for its team", async () => {
    const t = await resolveTenant(payload, user({ id: 10, role: "customer" }, false));
    expect(t.roles.get(3)).toBe("store_staff");
    expect(t.readOnly.has(3)).toBe(true);
  });
  it("shoppers get no store rights", async () => {
    const t = await resolveTenant(payload, user({ id: 99, role: "customer" }));
    expect(t.roles.size).toBe(0);
  });
});

/* ───────────── access rules against a known tenant ───────────── */

const tenant = (over: Partial<Tenant> = {}): Tenant => ({ userId: 7, platformAdmin: false, roles: new Map([[2, "store_manager"]]), activeStoreId: 2, defaultStoreId: 1, readOnly: new Set(), ...over });
const reqFor = (t: Tenant | null, payload: Payload = fakePayload({ stores: STORES, memberships: [] })) =>
  ({ user: t ? { id: t.userId ?? 1, collection: "users" } : null, payload, context: t ? { __shopengineTenant: { userId: t.userId ?? 1, tenant: t } } : {} }) as unknown as PayloadRequest;
const call = (rule: unknown, req: PayloadRequest, data?: unknown) => (rule as (a: { req: PayloadRequest; data?: unknown }) => unknown)({ req, data });

describe("record access is limited to the store being worked in", () => {
  it("reads: own store's rows; nothing below the minimum role", () => {
    expect(storeScope(tenant(), "store_staff")).toEqual({ store: { equals: 2 } });
    expect(storeScope(tenant(), "store_owner")).toBe(false);
    expect(storeScope(tenant({ platformAdmin: true, activeStoreId: null }), "store_owner")).toBe(true);
    expect(storeScope(tenant({ platformAdmin: true, activeStoreId: 3 }), "store_owner")).toEqual({ store: { equals: 3 } });
  });
  it("orders: the team sees the store's orders, a shopper only their own", async () => {
    const rule = readFor("store_staff", { self: "user" });
    expect(await call(rule, reqFor(tenant()))).toEqual({ or: [{ store: { equals: 2 } }, { user: { equals: 7 } }] });
    expect(await call(rule, reqFor(tenant({ roles: new Map(), activeStoreId: null, userId: 5 })))).toEqual({ user: { equals: 5 } });
  });
  it("creating needs a role in the TARGET store (a form can't point at another store)", async () => {
    const rule = createFor("store_staff");
    expect(await call(rule, reqFor(tenant()), { store: 2 })).toBe(true);
    expect(await call(rule, reqFor(tenant()), { store: 1 })).toBe(false);
    expect(await call(rule, reqFor(tenant()), {})).toBe(true);
  });
  it("a read-only (suspended / lapsed) store can't be changed", async () => {
    const t = tenant({ readOnly: new Set([2]) });
    expect(await call(writeFor("store_staff"), reqFor(t))).toBe(false);
    expect(await call(createFor("store_staff"), reqFor(t), { store: 2 })).toBe(false);
  });
  it("catalogue: public for shoppers, own store only for a store's team", async () => {
    const rule = publicOrStore("store_staff", { status: { equals: "active" } });
    expect(await call(rule, reqFor(null))).toEqual({ status: { equals: "active" } });
    expect(await call(rule, reqFor(tenant()))).toEqual({ store: { equals: 2 } });
  });
});

describe("the store of a new record is set by the server", () => {
  const hook = assignStore();
  const run = (req: PayloadRequest, data: Record<string, unknown>, operation: "create" | "update" = "create", originalDoc?: Record<string, unknown>, context: Record<string, unknown> = {}) =>
    (hook as unknown as (a: unknown) => Promise<Record<string, unknown>>)({ data, req, operation, originalDoc, context });

  it("defaults to the store being worked in", async () => {
    expect((await run(reqFor(tenant()), { title: "x" })).store).toBe(2);
  });
  it("refuses another store", async () => {
    await expect(run(reqFor(tenant()), { store: 1 })).rejects.toThrow();
  });
  it("can't be moved to another store later (except by a platform admin)", async () => {
    expect((await run(reqFor(tenant()), { store: 1 }, "update", { store: 2 })).store).toBe(2);
    expect((await run(reqFor(tenant({ platformAdmin: true })), { store: 3 }, "update", { store: 2 })).store).toBe(3);
  });
  it("the storefront's own code (no user) uses the store it passes", async () => {
    expect((await run(reqFor(null), { store: 2 }, "create", undefined, { storefront: true })).store).toBe(2);
  });
});

describe("accounts", () => {
  it("nobody edits their own role / platform role: only themselves or what their store team may", async () => {
    // a merchant: themselves, the customers of their store and their team – never everyone
    const r = (await call(usersUpdate, reqFor(tenant()))) as Record<string, unknown>;
    expect(r).not.toBe(true);
    expect(JSON.stringify(r)).toContain('"id":{"equals":7}');
  });
  it("only platform admins delete accounts", async () => {
    expect(await call(usersDelete, reqFor(tenant()))).toBe(false);
    expect(await call(usersDelete, reqFor(tenant({ platformAdmin: true })))).toBe(true);
  });
  it("a store's team reads its own customers, not every account", async () => {
    const r = await call(usersRead, reqFor(tenant()));
    expect(r).not.toBe(true);
  });
  it("owners and managers must set up 2-step", () => {
    expect(needsTwoFactorSetup({ id: 1, role: "owner", twoFactor: { enabled: false } } as never)).toBe(true);
  });
});

describe("who may sign in to /cms", () => {
  const payload = fakePayload({ stores: STORES, memberships: [{ id: 1, user: 7, store: 2, role: "store_owner", status: "active" }] });
  it("shoppers can't; store team members and the original team can; owners need 2-step", async () => {
    expect(await adminSeat(payload, user({ id: 99, role: "customer" }))).toEqual({ allowed: false, needsTwoFactor: false });
    expect(await adminSeat(payload, user({ id: 7, role: "customer" }))).toEqual({ allowed: true, needsTwoFactor: true });
    expect((await adminSeat(payload, user({ id: 5, role: "staff" }))).allowed).toBe(true);
  });
});

describe("store ids", () => {
  it("accept ids, numeric strings and populated docs", () => {
    expect(storeIdOf(3)).toBe(3);
    expect(storeIdOf("4")).toBe(4);
    expect(storeIdOf({ id: 5 })).toBe(5);
    expect(storeIdOf("x")).toBeNull();
    expect(storeIdOf(null)).toBeNull();
  });
});

describe("activity log changes", () => {
  it("shows only real changes (linked records by id, unreadable fields skipped)", () => {
    const prev = { price: 3500, brand: 8, images: [{ id: "a", image: 13 }], costPrice: 2500, title: "Mouse" };
    const next = { price: 3600, brand: { id: 8, name: "Logitech", createdAt: "x", updatedAt: "y" }, images: [{ id: "a", image: { id: 13, filename: "m.webp", createdAt: "x" } }], title: "Mouse" };
    expect(diff(prev, next)).toEqual([{ field: "price", from: "3,500", to: "3,600" }]);
  });
  it("never records passwords or 2-step secrets", () => {
    expect(diff({ password: "a", twoFactor: { secret: "x" }, name: "A" }, { password: "b", twoFactor: { secret: "y" }, name: "B" })).toEqual([{ field: "name", from: "A", to: "B" }]);
  });
  it("cuts long text by whole characters (no broken emoji)", () => {
    const long = "a".repeat(76) + "😀" + "b".repeat(20);
    const [c] = diff({ title: "x" }, { title: long });
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(c.to)).toBe(false);
    expect(c.to.endsWith("…")).toBe(true);
  });
});
