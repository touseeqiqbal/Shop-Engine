import { describe, expect, it } from "vitest";
import { canOpenAdmin, deletableUsers, editableUsers, getUserStoreIds, isManagerUser, isOwnerUser, isStaffUser, needsTwoFactorSetup, storeScopedAccess } from "@/payload/access";

type Role = "owner" | "manager" | "staff" | "customer";
const user = (role: Role, twoFactor = true) => ({ id: 1, role, twoFactor: { enabled: twoFactor } });
const run = (rule: unknown, u: unknown) => (rule as (a: { req: { user: unknown } }) => unknown)({ req: { user: u } });

describe("roles and 2-step", () => {
  it("owners and managers without 2-step get no admin rights, only the setup", () => {
    expect(needsTwoFactorSetup(user("owner", false))).toBe(true);
    expect(canOpenAdmin(user("owner", false))).toBe(true);
    expect(isStaffUser(user("owner", false))).toBe(false);
    expect(isManagerUser(user("manager", false))).toBe(false);
    expect(isOwnerUser(user("owner"))).toBe(true);
  });
  it("staff may choose; customers never get in", () => {
    expect(isStaffUser(user("staff", false))).toBe(true);
    expect(canOpenAdmin(user("customer"))).toBe(false);
  });
  it("tenant store ids are normalized from currentStore and stores relations", () => {
    expect(getUserStoreIds({ id: 1, currentStore: "store-1", stores: [2, { id: "store-2" }, null] })).toEqual(["store-1", 2, "store-2"]);
    expect(storeScopedAccess()( { req: { user: { id: 5, role: "customer", currentStore: 9, stores: [9, 10] } } } as never)).toEqual({ store: { in: [9, 10] } });
  });
  it("merchant roles are allowed to open the admin and can be treated as manager or owner", () => {
    expect(canOpenAdmin({ id: 7, platformRole: "merchant_owner" } as never)).toBe(true);
    expect(isManagerUser({ id: 7, platformRole: "merchant_manager", twoFactor: { enabled: true } } as never)).toBe(true);
    expect(isOwnerUser({ id: 7, platformRole: "merchant_owner", twoFactor: { enabled: true } } as never)).toBe(true);
    expect(needsTwoFactorSetup({ id: 7, platformRole: "merchant_manager" } as never)).toBe(true);
  });
});

describe("who may change or delete an account", () => {
  it("yourself or someone below you", () => {
    expect(run(editableUsers, user("owner"))).toBe(true);
    expect(run(editableUsers, user("manager"))).toEqual({ or: [{ id: { equals: 1 } }, { role: { in: ["staff", "customer"] } }] });
    expect(run(editableUsers, user("staff"))).toEqual({ or: [{ id: { equals: 1 } }, { role: { equals: "customer" } }] });
    expect(run(editableUsers, user("customer"))).toEqual({ id: { equals: 1 } });
    expect(run(editableUsers, user("owner", false))).toEqual({ id: { equals: 1 } });
    expect(run(editableUsers, null)).toBe(false);
  });
  it("deleting", () => {
    expect(run(deletableUsers, user("owner"))).toBe(true);
    expect(run(deletableUsers, user("manager"))).toEqual({ role: { in: ["staff", "customer"] } });
    expect(run(deletableUsers, user("staff"))).toBe(false);
  });
});

import { diff } from "@/payload/collections/history";

describe("activity log changes", () => {
  it("shows only real changes (linked records by id, unreadable fields skipped)", () => {
    const prev = { price: 3500, brand: 8, images: [{ id: "a", image: 13 }], costPrice: 2500, title: "Mouse" };
    const next = { price: 3600, brand: { id: 8, name: "Logitech", createdAt: "x", updatedAt: "y" }, images: [{ id: "a", image: { id: 13, filename: "m.webp", createdAt: "x" } }], title: "Mouse" };
    expect(diff(prev, next)).toEqual([{ field: "price", from: "3,500", to: "3,600" }]);
  });
  it("never records passwords or 2-step secrets", () => {
    expect(diff({ password: "a", twoFactor: { secret: "x" }, name: "A" }, { password: "b", twoFactor: { secret: "y" }, name: "B" })).toEqual([{ field: "name", from: "A", to: "B" }]);
  });
});

describe("activity log text", () => {
  it("cuts long text by whole characters (no broken emoji)", () => {
    const long = "a".repeat(76) + "😀" + "b".repeat(20);
    const [c] = diff({ title: "x" }, { title: long });
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(c.to)).toBe(false);
    expect(c.to.endsWith("…")).toBe(true);
  });
});
