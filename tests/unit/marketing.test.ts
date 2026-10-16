import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { Payload, PayloadRequest } from "payload";
import { isMarketingHost, marketingHosts, PASS_THROUGH } from "@/lib/marketing/hosts";
import { marketingRoutes } from "@/lib/marketing/routes";
import { ARTICLES, CONTACT_TOPICS, FAQS, FEATURES, PLANNED } from "@/lib/marketing/content";
import { SOLUTIONS } from "@/lib/marketing/solutions";
import { COUNTRY_CODES } from "@/lib/locale";
import { assignStore, type Tenant } from "@/payload/tenancy";

const PAGES = fileURLToPath(new URL("../../src/app/(marketing)/shopengine", import.meta.url));

describe("marketing addresses (MARKETING_HOSTS)", () => {
  const before = process.env.MARKETING_HOSTS;
  afterEach(() => {
    process.env.MARKETING_HOSTS = before;
  });

  it("is off unless addresses are listed", () => {
    process.env.MARKETING_HOSTS = "";
    expect(marketingHosts().size).toBe(0);
    expect(isMarketingHost("shopengine.app")).toBe(false);
  });
  it("matches listed hosts with any port / case, nothing else", () => {
    process.env.MARKETING_HOSTS = "ShopEngine.app, www.shopengine.app";
    expect(isMarketingHost("shopengine.app")).toBe(true);
    expect(isMarketingHost("WWW.shopengine.app:443")).toBe(true);
    // store addresses on the platform domain stay stores
    expect(isMarketingHost("acme.shopengine.app")).toBe(false);
    expect(isMarketingHost("shopengine.app.evil.com")).toBe(false);
    expect(isMarketingHost(null)).toBe(false);
  });
  it("accounts, admin, APIs and files pass through; marketing paths don't", () => {
    for (const p of ["/account/login", "/account", "/cms", "/cms/collections/orders", "/cms-api/users/login", "/api/health", "/_next/static/x.js", "/media/a.jpg"]) expect(PASS_THROUGH.test(p), p).toBe(true);
    for (const p of ["/", "/features", "/pricing", "/accounting", "/cmsx", "/apis", "/blog/x"]) expect(PASS_THROUGH.test(p), p).toBe(false);
  });
});

describe("marketing pages", () => {
  it("every sitemap address has a page", () => {
    for (const { path } of marketingRoutes()) {
      const parts = path.split("/").filter(Boolean);
      const direct = `${PAGES}/${parts.join("/")}/page.tsx`.replace("//page", "/page");
      const dynamic = parts.length === 2 ? `${PAGES}/${parts[0]}/[slug]/page.tsx` : "";
      expect(existsSync(direct) || (dynamic && existsSync(dynamic)), path).toBe(true);
    }
  });
  it("addresses are unique", () => {
    const paths = marketingRoutes().map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
  it("content is complete and consistent", () => {
    expect(FEATURES).toHaveLength(12);
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(12);
    expect(FAQS).toHaveLength(10);
    expect(PLANNED.length).toBeGreaterThan(0);
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // solution pages only link to features that exist
    for (const s of SOLUTIONS) for (const id of s.features) expect(FEATURES.some((f) => f.id === id), `${s.slug} → ${id}`).toBe(true);
    expect(CONTACT_TOPICS).toContain("Security report");
  });
  it("the figures on the homepage are counted from the code", () => {
    // "180+ countries" – the homepage rounds COUNTRY_CODES down to the nearest ten
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(180);
    expect(FEATURES.length).toBe(12);
  });
  it("makes no unsupported claims (ratings, customer counts, certifications)", () => {
    const text = JSON.stringify({ FEATURES, FAQS, ARTICLES, SOLUTIONS }).toLowerCase();
    for (const banned of ["trusted by", "5 stars", "ratingvalue", "iso 27001", "soc 2", "pci dss level 1", "99.99%"]) expect(text).not.toContain(banned);
  });
});

describe("ShopEngine's own contact inbox", () => {
  const hook = assignStore();
  const run = (req: PayloadRequest, data: Record<string, unknown>, context: Record<string, unknown>) =>
    (hook as unknown as (a: unknown) => Promise<Record<string, unknown>>)({ data, req, operation: "create", context });
  const anonymous = { user: null, payload: {} as Payload, context: {} } as unknown as PayloadRequest;

  it("a marketing-site message belongs to no store (only platform admins see it)", async () => {
    expect((await run(anonymous, { name: "x", store: 4 }, { platformInbox: true })).store).toBeNull();
  });
  it("a signed-in person can't use the flag to drop a record's store", async () => {
    const tenant: Tenant = { userId: 7, platformAdmin: false, roles: new Map([[2, "store_manager"]]), activeStoreId: 2, defaultStoreId: 1, readOnly: new Set() };
    const signedIn = { user: { id: 7, collection: "users" }, payload: {} as Payload, context: { __shopengineTenant: { userId: 7, tenant } } } as unknown as PayloadRequest;
    expect((await run(signedIn, { name: "x" }, { platformInbox: true })).store).toBe(2);
  });
});
