/**
 * Mobile page speed in a real headless Chrome, with Lighthouse's phone settings: 390 px screen, CPU 4× slower,
 * "slow 4G" (150 ms round trip, 1.6 Mbit/s down). Each page is loaded twice with an empty cache; the better load counts.
 * Prints LCP (largest content shown), FCP, CLS, long-task blocking time and the bytes downloaded.
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/tests/perf-mobile.mjs [/path …]
 *   PERF_LCP_BUDGET_MS=4000   fail when a page's LCP is above this (default: report only)
 */
import { launch } from "./lib/chrome.mjs";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/shop", "/e2e-tests/e2e-test-mouse", "/checkout"];
const BUDGET = Number(process.env.PERF_LCP_BUDGET_MS) || 0;

const OBSERVE = `
  window.__perf = { lcp: 0, cls: 0, tbt: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
`;

async function measure(path, port) {
  const b = await launch({ port, mobile: true });
  try {
    await b.send("Network.enable");
    await b.send("Network.setCacheDisabled", { cacheDisabled: true });
    await b.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await b.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await b.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    let best = null;
    for (let run = 0; run < 2; run++) {
      await b.send("Page.navigate", { url: `${BASE}${path}` });
      await b.waitFor(`return document.readyState === "complete"`, 90_000);
      // LCP settles after load; give late images and fonts a moment
      await new Promise((r) => setTimeout(r, 4000));
      const m = await b.eval(`const nav = performance.getEntriesByType("navigation")[0]; const fcp = performance.getEntriesByName("first-contentful-paint")[0]; const res = performance.getEntriesByType("resource"); const js = res.filter((r) => r.initiatorType === "script" || r.name.endsWith(".js")); return { status: nav?.responseStatus ?? null, ttfb: Math.round(nav?.responseStart ?? 0), fcp: Math.round(fcp?.startTime ?? 0), lcp: Math.round(window.__perf.lcp), cls: Math.round(window.__perf.cls * 1000) / 1000, tbt: Math.round(window.__perf.tbt), kb: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), (nav?.transferSize || 0)) / 1024), jsKb: Math.round(js.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024), requests: res.length + 1 };`);
      if (!best || (m.lcp && m.lcp < best.lcp)) best = m;
    }
    return best;
  } finally {
    await b.close();
  }
}

let failed = 0;
let port = 9600;
console.log("page".padEnd(32), "status  TTFB   FCP    LCP    CLS    TBT   KB(JS)");
for (const path of PAGES) {
  const m = await measure(path, port++);
  const over = BUDGET && m.lcp > BUDGET;
  if (over || m.status >= 400) failed++;
  console.log(`${over ? "✗" : "✓"} ${path.padEnd(30)} ${String(m.status).padEnd(6)} ${String(m.ttfb).padStart(5)} ${String(m.fcp).padStart(6)} ${String(m.lcp).padStart(6)} ${String(m.cls).padStart(6)} ${String(m.tbt).padStart(6)}  ${m.kb}(${m.jsKb})`);
}
console.log(failed ? `Mobile speed: ${failed} page(s) over budget or failing` : "Mobile speed measured");
process.exit(failed ? 1 : 0);
