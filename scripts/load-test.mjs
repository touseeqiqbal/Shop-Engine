/**
 * Sale-day load test (e.g. 11.11): many shoppers at once browsing home, product, category and search pages
 * and opening checkout. Prints requests/second, response times (p50 / p95 / p99) and errors per page type.
 * Overselling under load is tested separately by `npm run test:stock` (BUYERS=200 STOCK=20).
 *
 *   npm run test:load -- http://localhost:3100 --users 50 --seconds 60
 *   npm run test:load -- https://<staging-domain> --users 100 --seconds 120     (STAGING_USER / STAGING_PASSWORD)
 *
 * Run it against staging or a local production build – not against the live shop (add --i-know-this-is-live to force).
 */

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) || "http://localhost:3000").replace(/\/$/, "");
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const users = opt("users", 30);
const seconds = opt("seconds", 30);
if (/urkotechstore\.com/.test(base) && !/staging/.test(base) && !args.includes("--i-know-this-is-live")) {
  console.error("This looks like the live shop. Run the load test on staging (or add --i-know-this-is-live).");
  process.exit(2);
}
const headers = { "User-Agent": "UrkoLoadTest/1.0", ...(process.env.STAGING_USER ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") } : {}) };

// Real URLs from the sitemap
const sitemap = await (await fetch(`${base}/sitemap.xml`, { headers })).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const products = urls.filter((u) => u.split("/").length === 3 && !/^\/(blog|brands|pages|collections|category)\//.test(u));
const categories = urls.filter((u) => u.startsWith("/category/"));
if (!products.length) {
  console.error("No product URLs found in the sitemap");
  process.exit(2);
}
const words = ["laptop", "dell", "hp", "charger", "ssd", "ram", "lenovo", "core i5", "mouse", "keyboard"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SCENARIOS = [
  { name: "home", weight: 25, path: () => "/" },
  { name: "product", weight: 35, path: () => pick(products) },
  { name: "category", weight: 15, path: () => pick(categories.length ? categories : ["/shop"]) },
  { name: "search", weight: 15, path: () => `/api/search?q=${encodeURIComponent(pick(words))}` },
  { name: "checkout", weight: 10, path: () => "/checkout" },
];
const total = SCENARIOS.reduce((s, x) => s + x.weight, 0);
const choose = () => {
  let r = Math.random() * total;
  for (const s of SCENARIOS) if ((r -= s.weight) < 0) return s;
  return SCENARIOS[0];
};

const stats = Object.fromEntries(SCENARIOS.map((s) => [s.name, { times: [], errors: 0, codes: {} }]));
const end = Date.now() + seconds * 1000;

async function shopper() {
  while (Date.now() < end) {
    const s = choose();
    const t = performance.now();
    try {
      const res = await fetch(base + s.path(), { headers, signal: AbortSignal.timeout(30_000) });
      await res.arrayBuffer();
      stats[s.name].codes[res.status] = (stats[s.name].codes[res.status] || 0) + 1;
      if (res.status >= 500) stats[s.name].errors++;
    } catch {
      stats[s.name].errors++;
    }
    stats[s.name].times.push(performance.now() - t);
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 800)); // think time between clicks
  }
}

console.log(`Load test: ${users} shoppers for ${seconds}s against ${base} (${products.length} products)…`);
const started = Date.now();
await Promise.all(Array.from({ length: users }, shopper));
const elapsed = (Date.now() - started) / 1000;

const q = (arr, p) => (arr.length ? Math.round(arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))]) : 0);
let all = 0;
let errs = 0;
console.log("\npage       requests  p50 ms  p95 ms  p99 ms  errors  status codes");
for (const [name, s] of Object.entries(stats)) {
  all += s.times.length;
  errs += s.errors;
  console.log(`${name.padEnd(10)} ${String(s.times.length).padStart(8)}  ${String(q(s.times, 50)).padStart(6)}  ${String(q(s.times, 95)).padStart(6)}  ${String(q(s.times, 99)).padStart(6)}  ${String(s.errors).padStart(6)}  ${JSON.stringify(s.codes)}`);
}
const p95 = Math.max(...Object.values(stats).map((s) => q(s.times, 95)));
console.log(`\n${all} requests in ${elapsed.toFixed(0)}s = ${(all / elapsed).toFixed(1)} req/s · errors ${errs} (${((errs / Math.max(1, all)) * 100).toFixed(2)}%) · worst p95 ${p95} ms`);
const pass = errs / Math.max(1, all) < 0.01 && p95 < 5000;
console.log(pass ? "PASS (errors < 1%, p95 < 5 s)" : "FAIL (errors ≥ 1% or p95 ≥ 5 s)");
process.exit(pass ? 0 : 1);
