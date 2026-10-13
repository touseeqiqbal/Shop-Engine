// URL preservation check for the Payload migration.
//
//   node scripts/migrate/url-check.mjs snapshot http://localhost:3000 > url-baseline.json
//   node scripts/migrate/url-check.mjs compare  http://localhost:3000 url-baseline.json
//
// `snapshot` crawls sitemap.xml (+ a few non-sitemap routes) and records each path's status and redirect target.
// `compare` re-checks every baseline path against a (new) deployment and fails if a URL that used to work now
// 404s/500s, or now redirects without a permanent (301/308) redirect.
import fs from "node:fs";

const [mode, base, baselineFile] = process.argv.slice(2);
if (!["snapshot", "compare"].includes(mode) || !base) {
  console.error("usage: url-check.mjs snapshot <baseUrl> | compare <baseUrl> <baseline.json>");
  process.exit(2);
}
const auth = process.env.STAGING_USER && process.env.STAGING_PASSWORD
  ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") }
  : {};

const EXTRA = ["/", "/shop", "/category", "/deals", "/brands", "/find-parts", "/compare", "/cart", "/checkout", "/track-order",
  "/account/login", "/wholesale", "/blog", "/sitemap.xml", "/robots.txt", "/llms.txt", "/manifest.webmanifest", "/opengraph-image"];

async function check(path) {
  const res = await fetch(base + path, { redirect: "manual", headers: auth });
  const location = res.headers.get("location");
  return { status: res.status, location: location ? location.replace(base, "") : null };
}

async function sitemapPaths() {
  const xml = await (await fetch(base + "/sitemap.xml", { headers: auth })).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

async function pool(items, fn, n = 6) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

if (mode === "snapshot") {
  const paths = [...new Set([...EXTRA, ...(await sitemapPaths())])].sort();
  const results = await pool(paths, check);
  const snap = Object.fromEntries(paths.map((p, i) => [p, results[i]]));
  console.log(JSON.stringify({ base, takenAt: new Date().toISOString(), urls: snap }, null, 2));
  const bad = paths.filter((p) => snap[p].status >= 400);
  console.error(`${paths.length} URLs snapshotted, ${bad.length} non-2xx/3xx${bad.length ? ": " + bad.join(", ") : ""}`);
} else {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8")).urls;
  const paths = Object.keys(baseline);
  const now = await pool(paths, check);
  let failures = 0, rows = [];
  paths.forEach((p, i) => {
    const before = baseline[p], after = now[i];
    let verdict = "same";
    if (before.status < 400 && after.status >= 400) verdict = "BROKEN";
    else if (before.status === 200 && [302, 303, 307].includes(after.status)) verdict = "TEMP-REDIRECT";
    else if (before.status === 200 && [301, 308].includes(after.status)) verdict = "301 →" + after.location;
    else if (before.status !== after.status) verdict = `changed ${before.status}→${after.status}`;
    if (verdict === "BROKEN" || verdict === "TEMP-REDIRECT") failures++;
    if (verdict !== "same") rows.push(`${verdict.padEnd(18)} ${p}`);
  });
  console.log(rows.length ? rows.join("\n") : "No differences.");
  console.log(`\n${paths.length} URLs checked: ${paths.length - rows.length} identical, ${rows.length} changed, ${failures} problem(s).`);
  process.exit(failures ? 1 : 0);
}
