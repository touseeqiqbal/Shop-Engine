// Storefront + CMS smoke tests. Run against any deployment (local production build, staging, live):
//   node scripts/smoke-test.mjs http://localhost:3000
// Staging: set STAGING_USER / STAGING_PASSWORD for Basic Auth. Exits 1 on any failure.
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const headers = process.env.STAGING_USER && process.env.STAGING_PASSWORD
  ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") }
  : {};

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (e) {
    results.push([false, name, e.message]);
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const get = async (path, opts = {}) => fetch(base + path, { redirect: "manual", ...opts, headers: { ...headers, ...(opts.headers || {}) } });
const html = async (path) => {
  const r = await get(path);
  assert(r.status === 200, `${path} → HTTP ${r.status}`);
  return r.text();
};
const jsonLd = (doc) => [...doc.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
  const v = JSON.parse(m[1]);
  return Array.isArray(v) ? v : [v];
});
const types = (doc) => jsonLd(doc).flatMap((x) => (Array.isArray(x["@type"]) ? x["@type"] : [x["@type"]]));

// ── Pages: 200, exactly one <h1>, canonical, parseable JSON-LD ──
const PAGES = {
  "/": ["ElectronicsStore", "WebSite", "Organization"],
  "/category/laptops": ["BreadcrumbList", "ItemList"],
  "/laptops/hp-elitebook-840-g8-core-i5-11th-gen": ["Product", "BreadcrumbList"],
  "/chargers/dell-65w-type-c-laptop-charger": ["Product"],
  "/shop": [],
  "/deals": [],
  "/find-parts": [],
  "/brands/hp": [],
  "/blog": [],
  "/blog/how-to-choose-laptop-charger": ["Article"],
  "/faqs": ["FAQPage"],
  "/about": [],
  "/contact": [],
  "/wholesale": ["FAQPage"],
  "/laptops-in-lahore": ["FAQPage"],
  "/track-order": [],
  "/cart": [],
  "/checkout": [],
};
for (const [path, expectTypes] of Object.entries(PAGES)) {
  await test(`page ${path}`, async () => {
    const doc = await html(path);
    const h1 = (doc.match(/<h1[\s>]/g) || []).length;
    assert(h1 === 1, `expected 1 <h1>, found ${h1}`);
    if (!["/cart", "/checkout"].includes(path)) assert(/<link rel="canonical"/.test(doc), "missing canonical");
    const t = types(doc); // throws if any JSON-LD block is invalid JSON
    for (const ty of expectTypes) assert(t.includes(ty), `missing JSON-LD ${ty} (has ${[...new Set(t)].join(", ")})`);
  });
}

// ── Product price in PKR in Product schema ──
await test("Product JSON-LD has PKR price & availability", async () => {
  const p = jsonLd(await html("/laptops/hp-elitebook-840-g8-core-i5-11th-gen")).find((x) => x["@type"] === "Product");
  assert(p?.offers?.priceCurrency === "PKR" && Number(p.offers.price) > 0, "offer missing PKR price");
  assert(/schema\.org\/(InStock|OutOfStock)/.test(p.offers.availability), "missing availability");
});

// ── Errors / redirects ──
await test("unknown product → 404", async () => assert((await get("/laptops/does-not-exist-xyz")).status === 404, "not 404"));
await test("unknown deep URL → 404", async () => assert((await get("/a/b/c/d")).status === 404, "not 404"));
await test("category slug at root → 308 /category/…", async () => {
  const r = await get("/mouse");
  assert([301, 308].includes(r.status) && r.headers.get("location")?.endsWith("/category/mouse"), `got ${r.status} ${r.headers.get("location")}`);
});

// ── SEO files ──
await test(headers.Authorization ? "robots.txt blocks crawlers (staging)" : "robots.txt", async () => {
  const t = await (await get("/robots.txt")).text();
  if (headers.Authorization) assert(/Disallow:\s*\/\s*$/m.test(t), "staging robots.txt must disallow everything");
  else assert(/Sitemap:/i.test(t), "no Sitemap line");
});
await test("sitemap.xml lists products", async () => {
  const t = await (await get("/sitemap.xml")).text();
  assert((t.match(/<loc>/g) || []).length > 50 && t.includes("/laptops/"), "sitemap too small or missing products");
});
await test("llms.txt", async () => assert((await (await get("/llms.txt")).text()).includes("## Products"), "missing products section"));

// ── Media: served from our route, cached for a year, script-proof ──
await test("media caching & security headers", async () => {
  const doc = await html("/laptops/hp-elitebook-840-g8-core-i5-11th-gen");
  // a real image link (right after a quote) – not the "/media/…" inside a share-image URL like /feed-image/media/…
  const src = doc.match(/(?<=["'])\/(?:media|images)\/[^"&\s]+\.(?:webp|svg|png|jpg)/)?.[0];
  assert(src, "no product image found");
  const r = await get(src);
  assert(r.status === 200, `${src} → ${r.status}`);
  if (src.startsWith("/media/")) {
    assert(/immutable/.test(r.headers.get("cache-control") || ""), "media not immutable-cached");
    assert(/sandbox/.test(r.headers.get("content-security-policy") || ""), "media missing CSP");
  }
});
await test("private payment proofs are not public", async () => assert((await get("/media/payments/x/y.png")).status === 404, "payments/ served publicly!"));

// ── Security headers ──
await test("security headers", async () => {
  const r = await get("/");
  for (const h of ["x-content-type-options", "referrer-policy", "strict-transport-security", "x-frame-options"]) assert(r.headers.get(h), `missing ${h}`);
});

// ── CMS & health ──
await test("Payload admin login page", async () => assert((await get("/cms/login")).status === 200, "cms login not 200"));
await test("old /admin redirects to /cms", async () => {
  const res = await get("/admin/orders");
  assert([307, 308].includes(res.status) && (res.headers.get("location") ?? "").endsWith("/cms"), `got ${res.status} ${res.headers.get("location")}`);
});
await test("Payload API rejects anonymous order reads", async () => {
  const r = await get("/cms-api/orders");
  const body = await r.json().catch(() => ({}));
  assert(r.status === 403 || (Array.isArray(body.docs) && body.docs.length === 0), `orders readable anonymously (HTTP ${r.status})`);
});
await test("Payload API hides draft products", async () => {
  const body = await (await get("/cms-api/products?limit=100&depth=0")).json();
  assert(Array.isArray(body.docs) && body.docs.every((d) => d.status === "active"), "non-active products exposed");
  assert(body.docs.every((d) => d.costPrice === undefined), "costPrice exposed publicly");
});
await test("shop counter API and print pages are staff-only", async () => {
  for (const path of ["/cms-api/pos/lookup?q=test", "/cms-api/pos/cashup", "/cms-print/1"]) {
    const r = await get(path);
    assert(r.status === 401, `${path} answered ${r.status} to an anonymous visitor`);
  }
  const units = await (await get("/cms-api/units")).json().catch(() => ({}));
  assert(!Array.isArray(units.docs) || units.docs.length === 0, "laptop units readable anonymously");
});
await test("order confirmation link rejects unknown tokens; cron needs its key", async () => {
  const page = await get("/confirm-order/not-a-real-token-1234567890");
  assert(page.status === 200 && (await page.text()).includes("Link not valid"), `confirm page answered ${page.status}`);
  const cron = await fetch(`${base}/api/cron`, { method: "POST", headers });
  assert([401, 404].includes(cron.status), `/api/cron ran without a key (HTTP ${cron.status})`);
});
await test("returns page loads; customer photos are staff-only", async () => {
  const page = await get("/returns");
  assert(page.status === 200 && (await page.text()).includes("Find my order"), `/returns answered ${page.status}`);
  assert((await get("/cms-file?key=returns/x/y.jpg")).status === 401, "return photos readable anonymously");
  assert((await get("/cms-print/credit-note/1")).status === 401, "credit notes readable anonymously");
});
await test("product feeds (Google, Meta, TikTok)", async () => {
  for (const f of ["/feeds/google.xml", "/feeds/meta.xml"]) {
    const r = await get(f);
    const t = await r.text();
    assert(r.status === 200 && t.includes("<g:price>") && t.includes("PKR"), `${f} answered ${r.status} without priced items`);
  }
  const csv = await get("/feeds/tiktok.csv");
  assert(csv.status === 200 && (await csv.text()).startsWith("sku_id,"), "TikTok feed missing");
});
await test("sell-your-laptop page; trade-ins, questions and carts are private", async () => {
  const page = await get("/sell-your-laptop");
  assert(page.status === 200 && (await page.text()).includes("Get my offer"), `/sell-your-laptop answered ${page.status}`);
  for (const c of ["trade-ins", "abandoned-carts", "stock-alerts"]) {
    const body = await (await get(`/cms-api/${c}`)).json().catch(() => ({}));
    assert(!Array.isArray(body.docs) || body.docs.length === 0, `${c} readable anonymously`);
  }
  const q = await (await get("/cms-api/product-questions")).json().catch(() => ({}));
  assert(!Array.isArray(q.docs) || q.docs.every((d) => d.published && d.email === undefined), "unpublished questions or emails exposed");
});
await test("health endpoint", async () => assert((await (await get("/api/health")).json()).ok === true, "health not ok"));

const failed = results.filter((r) => !r[0]);
for (const [ok, name, err] of results) console.log(`${ok ? "✓" : "✗"} ${name}${err ? ` — ${err}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
