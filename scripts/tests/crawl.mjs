/**
 * Storefront crawl: opens every page in the sitemap (plus the main static pages), then checks every internal
 * link and image found on them. Reports pages that fail, broken links, broken images, missing <title> /
 * meta description / canonical, and slow pages.
 *
 *   node scripts/tests/crawl.mjs [baseUrl]
 */
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const headers = { "User-Agent": "UrkoCrawler/1.0", ...(process.env.STAGING_USER ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") } : {}) };
const sitemap = await (await fetch(`${base}/sitemap.xml`, { headers })).text();
const pages = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).concat(["/cart", "/checkout", "/track-order", "/account/login", "/returns", "/sell-your-laptop", "/compare"]))];

const problems = [];
const links = new Map(); // path -> first page that links to it
const images = new Map();
const slow = [];
const pool = async (items, n, fn) => {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
};

await pool(pages, 6, async (path) => {
  const t = Date.now();
  let res;
  try {
    res = await fetch(base + path, { headers, redirect: "follow", signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    problems.push(`PAGE ${path} – ${e.message}`);
    return;
  }
  const ms = Date.now() - t;
  if (ms > 3000) slow.push(`${path} ${ms}ms`);
  if (res.status !== 200) return problems.push(`PAGE ${path} → HTTP ${res.status}`);
  const html = await res.text();
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (!/<title>[^<]{5,}<\/title>/.test(html)) problems.push(`SEO ${path} – missing <title>`);
  if (!noindex && !/<meta name="description" content="[^"]{20,}"/.test(html)) problems.push(`SEO ${path} – missing meta description`);
  if (!noindex && !/<link rel="canonical"/.test(html)) problems.push(`SEO ${path} – missing canonical`);
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/placeholder="[^"]*"/g, "");
  // case-insensitive only for phrases ("nano" must not match NaN)
  if (/lorem ipsum|placeholder text/i.test(visible) || /\bTODO\b|\bFIXME\b|>\s*undefined\s*<|\[object Object\]|\bNaN\b/.test(visible))
    problems.push(`TEXT ${path} – contains placeholder / undefined / NaN text`);
  for (const m of html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const p = m[1];
    if (/^\/(_next|cms|cms-api|api|media)\b/.test(p) || /\.(css|js|ico|png|svg|webmanifest|xml|txt)$/.test(p)) continue;
    if (!links.has(p)) links.set(p, path);
  }
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = m[1].replace(/&amp;/g, "&");
    if (src.startsWith("data:")) continue;
    const u = src.startsWith("http") ? src : base + (src.startsWith("/") ? src : `/${src}`);
    if (!u.startsWith(base)) continue;
    if (!images.has(u)) images.set(u, path);
  }
});

const checked = new Set(pages);
await pool([...links.keys()].filter((p) => !checked.has(p)), 6, async (p) => {
  const r = await fetch(base + p, { headers, redirect: "follow", signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!r || r.status >= 400) problems.push(`LINK ${p} (on ${links.get(p)}) → ${r ? `HTTP ${r.status}` : "failed"}`);
});
await pool([...images.keys()], 8, async (u) => {
  const r = await fetch(u, { headers, signal: AbortSignal.timeout(60_000) }).catch(() => null);
  const type = r?.headers.get("content-type") ?? "";
  if (!r || r.status >= 400 || !/^image\//.test(type)) problems.push(`IMAGE ${u.replace(base, "")} (on ${images.get(u)}) → ${r ? `HTTP ${r.status} ${type}` : "failed"}`);
  await r?.arrayBuffer().catch(() => undefined);
});

console.log(`Crawled ${pages.length} pages, ${links.size} internal links, ${images.size} images.`);
if (slow.length) console.log(`Slow (>3 s): ${slow.join(", ")}`);
if (problems.length) {
  console.log(`✗ ${problems.length} problem(s):`);
  for (const p of problems.sort()) console.log("  - " + p);
  process.exit(1);
}
console.log("✓ No broken pages, links or images");
