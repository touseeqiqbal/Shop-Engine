/**
 * The /cms screens added in the "fix all" pass, opened in a real headless Chrome as a store owner: each page must load,
 * show what it is for, and raise no errors. Screenshots go to ADMIN_SMOKE_SHOTS (a folder) when set.
 * Needs a running server with TWO_FACTOR_REQUIRED=false (local only) and the account from admin-smoke-user.ts.
 *
 *   ADMIN_SMOKE_PASSWORD=… E2E_BASE_URL=http://localhost:3100 node scripts/tests/admin-smoke.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { launch } from "./lib/chrome.mjs";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SHOTS = process.env.ADMIN_SMOKE_SHOTS || "";
const ORDER = process.env.ADMIN_SMOKE_ORDER || "";
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};

const PAGES = [
  ["gift-cards", "/cms/collections/gift-cards", ["Gift cards"]],
  ["gift-card-new", "/cms/collections/gift-cards/create", ["Value", "Balance left", "Email the gift card"]],
  ["loyalty-accounts", "/cms/collections/loyalty-accounts", ["Loyalty points"]],
  ["unsubscribed", "/cms/collections/email-optouts", ["Unsubscribed"]],
  ["stock-value", "/cms/reports/stock-value", ["Stock value", "At cost", "How long since it last sold"]],
  // the product edit page (it was blank for a store's team before readVersions was fixed); new fields on "Pricing & stock"
  ["product", "/cms/collections/products/17", ["When sold out", "Tax"], "Pricing & stock"],
  ["flash-sale-new", "/cms/collections/flash-sales/create", ["% off while it runs", "Starts"]],
  ["loyalty-settings", "/cms/settings/conversion", ["Loyalty points"]],
  ["tax-settings", "/cms/settings/payments", ["Reduced rate"]],
  ["shop-funnel", "/cms/reports/funnel", ["Shop funnel", "Product views", "Most viewed products"]],
  ["digital-files", "/cms/collections/digital-files", ["Digital files"]],
  ["collection-new", "/cms/collections/product-collections/create", ["Show from", "Show until"]],
  ...(ORDER ? [["order", `/cms/collections/orders/${ORDER}`, ["Invoice to"]]] : []),
];

const b = await launch({ port: 9562, width: 1400, height: 1000 });
try {
  await b.go(`${BASE}/cms/login`, 2500);
  await b.waitFor(`return Boolean(document.querySelector('input[type="email"], input[name="email"]'))`, 60_000);
  await b.type('input[type="email"], input[name="email"]', "admin.smoke@test.local");
  await b.type('input[type="password"]', process.env.ADMIN_SMOKE_PASSWORD || "");
  await b.eval(`(document.querySelector('form button[type="submit"]') ?? [...document.querySelectorAll("button")].find((x) => /log ?in|sign ?in/i.test(x.textContent)))?.click(); return true;`);
  const inside = await b.waitFor(`return !location.pathname.startsWith("/cms/login") && location.pathname.startsWith("/cms") ? location.pathname : null`, 60_000);
  check(Boolean(inside), `signed in to /cms (${inside || (await b.eval("return location.pathname"))})`);
  for (const [name, url, texts, tab] of PAGES) {
    const before = b.errors.length;
    await b.go(`${BASE}${url}`, 3000);
    if (tab) {
      await b.waitFor(`return [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === ${JSON.stringify(tab)})`, 120_000);
      await b.eval(`[...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(tab)})?.click(); return true;`);
    }
    const found = await b.waitFor(`const t = document.body.innerText; return ${JSON.stringify(texts)}.every((x) => t.includes(x))`, 45_000);
    const crashed = await b.eval(`return /Application error|Unhandled Runtime Error|Something went wrong|This page could not be found/i.test(document.body.innerText)`);
    const errs = b.errors.slice(before).filter((e) => !/favicon|Failed to load resource|hydrat|Download the React DevTools/i.test(String(e)));
    check(Boolean(found) && !crashed && errs.length === 0, `${name}: ${url}${found ? "" : ` – missing ${texts.join(" / ")}`}${crashed ? " – error page" : ""}${errs.length ? ` – ${errs.slice(0, 2).join(" | ").slice(0, 200)}` : ""}`);
    if (SHOTS) writeFileSync(path.join(SHOTS, `${name}.png`), await b.screenshot());
  }
} catch (e) {
  console.log(`✗ ${e?.message ?? e}`);
  failed++;
} finally {
  await b.close();
}
console.log(failed ? `Admin screens FAILED (${failed})` : "Admin screens passed");
process.exit(failed ? 1 : 0);
