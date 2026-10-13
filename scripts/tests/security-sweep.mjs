/**
 * Security sweep: asks the Payload API for every collection and global WITHOUT signing in and checks that
 * nothing private comes back (customer details, orders, staff data, cost prices, secrets, unpublished content).
 *
 *   node scripts/tests/security-sweep.mjs [baseUrl]
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const headers = process.env.STAGING_USER ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") } : {};

// collection → what an anonymous visitor may see ("none" = must be empty / denied)
const COLLECTIONS = {
  users: "none",
  orders: "none",
  "return-requests": "none",
  "warranty-claims": "none",
  "pos-sales": "none",
  "cash-ups": "none",
  units: "none",
  "blocked-phones": "none",
  "trade-ins": "none",
  "stock-alerts": "none",
  "abandoned-carts": "none",
  "contact-messages": "none",
  "wholesale-inquiries": "none",
  discounts: "none",
  suppliers: "none",
  purchases: "none",
  "stock-counts": "none",
  imports: "none",
  exports: "none",
  "payload-jobs": "none",
  products: "public",
  categories: "public",
  brands: "public",
  "laptop-models": "public",
  reviews: "public",
  posts: "public",
  pages: "public",
  menus: "public",
  media: "public",
  "product-collections": "public",
  "flash-sales": "public",
  "product-questions": "public",
  redirects: "public",
};
const PRIVATE_GLOBALS = ["notifications", "order-protection", "sales-channels", "staff-guide"];
const PUBLIC_GLOBALS = ["shipping", "payments", "store-info", "seo-settings", "page-texts", "testimonials", "faqs", "theme-settings", "announcement-bar", "header", "footer", "whatsapp-button", "returns-policy", "cookie-notice", "conversion"];
const SECRET_KEYS = /^(password|hash|salt|resetPasswordToken|twoFactor|secret|pendingSecret|backupCodes|legacyPasswordHash|costPrice|email|phone|customer|confirmation|token|apiKey|sessions)$/i;

const problems = [];
const findSecrets = (obj, path = "") => {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.test(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) problems.push(`${path}${k} exposed`);
    if (typeof v === "object") findSecrets(v, `${path}${k}.`);
  }
};

for (const [slug, rule] of Object.entries(COLLECTIONS)) {
  const r = await fetch(`${base}/cms-api/${slug}?limit=50&depth=1`, { headers });
  const body = await r.json().catch(() => ({}));
  const docs = Array.isArray(body.docs) ? body.docs : [];
  if (rule === "none") {
    if (docs.length) problems.push(`${slug}: ${docs.length} document(s) readable anonymously`);
    continue;
  }
  if (slug === "products" && docs.some((d) => d.status !== "active")) problems.push("products: drafts / hidden products exposed");
  if (slug === "reviews" && docs.some((d) => d.approved !== true)) problems.push("reviews: unapproved reviews exposed");
  if (slug === "product-questions" && docs.some((d) => d.published !== true)) problems.push("product-questions: unpublished questions exposed");
  if (slug === "posts" && docs.some((d) => d._status && d._status !== "published")) problems.push("posts: drafts exposed");
  if (slug === "pages" && docs.some((d) => d._status && d._status !== "published")) problems.push("pages: drafts exposed");
  for (const d of docs) {
    const before = problems.length;
    // public content may mention the shop's own phone / email; only flag nested customer / user objects
    const { email: _e, phone: _p, ...rest } = d;
    findSecrets(rest, `${slug}#${d.id}.`);
    if (problems.length > before) break;
  }
}

for (const slug of PRIVATE_GLOBALS) {
  const r = await fetch(`${base}/cms-api/globals/${slug}`, { headers });
  const body = await r.json().catch(() => ({}));
  if (r.status === 200 && Object.keys(body).some((k) => !["id", "globalType", "createdAt", "updatedAt", "errors", "message"].includes(k))) problems.push(`global ${slug} readable anonymously`);
}
for (const slug of PUBLIC_GLOBALS) {
  const r = await fetch(`${base}/cms-api/globals/${slug}?depth=1`, { headers });
  const body = await r.json().catch(() => ({}));
  const { email: _e, phones: _p, ...rest } = body;
  findSecrets(rest, `global ${slug}.`);
}

// Staff-only routes and files
for (const path of ["/cms-api/reports", "/cms-api/pos/lookup?q=dell", "/cms-api/order-tools/rto", "/cms-api/privacy/find?q=03001234567", "/cms-api/2fa/status", "/cms-print/1", "/cms-print/credit-note/1", "/cms-print/labels?type=products&ids=1", "/cms-proof/1", "/cms-file?key=returns/a/b.jpg", "/cms-api/config-export"]) {
  const r = await fetch(base + path, { headers, redirect: "manual" });
  if (r.status < 400) problems.push(`${path} answered ${r.status} without signing in`);
}
// Writes must be refused
for (const [slug, data] of [["orders", { orderNumber: "X" }], ["products", { title: "X" }], ["users", { email: "x@x.x", password: "xxxxxxxxxxxx", role: "owner" }], ["reviews", { name: "x", body: "x", rating: 5, approved: true }], ["pos-sales", {}]]) {
  const r = await fetch(`${base}/cms-api/${slug}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (r.status < 400) problems.push(`anonymous POST /cms-api/${slug} answered ${r.status}`);
}

if (problems.length) {
  console.log(`✗ ${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log("  - " + p);
  process.exit(1);
}
console.log("✓ Security sweep passed: no private data or staff routes reachable without signing in");
