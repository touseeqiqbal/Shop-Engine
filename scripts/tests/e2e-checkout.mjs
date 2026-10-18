/**
 * Browser test of the money path, in a real headless Chrome against a running site:
 * product page → add to cart → checkout (cash on delivery) → order placed → thank-you page with the order number,
 * on a desktop and a phone-sized screen; then with a gift card paying part of the order (the rest on delivery) and
 * one paying all of it; then a pre-order product (nothing in stock); then a signed-in customer who turns their loyalty
 * points into a voucher and pays with it. Needs the test products, cards and customer (scripts/tests/e2e-seed.ts) and
 * a running server.
 *
 *   E2E_BASE_URL=http://localhost:3000 node scripts/tests/e2e-checkout.mjs
 */
import { launch } from "./lib/chrome.mjs";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const PRODUCT = process.env.E2E_PRODUCT_PATH || "/e2e-tests/e2e-test-mouse";
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};

/** the seeded cards (scripts/tests/e2e-seed.ts) */
const GIFT = { part: { code: "E2EP-ART2-CARD-TEST", balance: 500 }, full: { code: "E2EF-ACEV-CARD-TEST", balance: 5000 } };

async function checkout(mobile, gift = null, preorder = false, loyal = false, digital = false) {
  const label = `${mobile ? "phone" : "desktop"}${digital ? " + download" : loyal ? " + loyalty voucher" : gift ? ` + gift card (${gift})` : ""}${preorder ? " + pre-order" : ""}`;
  const b = await launch({ port: mobile ? 9557 : digital ? 9561 : loyal ? 9560 : gift ? 9558 : preorder ? 9559 : 9556, mobile });
  try {
    if (loyal) {
      // sign in, then all points → a voucher on the account page
      await b.go(`${BASE}/account/login`, 1500);
      await b.waitFor(`return Boolean(document.querySelector('input[name="email"]'))`, 30_000);
      await b.type('input[name="email"]', "e2e.loyal@example.com");
      await b.type('input[name="password"]', process.env.E2E_CUSTOMER_PASSWORD || "E2e-Loyal-2026!");
      await b.clickText('button[type="submit"]', "Sign in");
      const inAccount = await b.waitFor(`return location.pathname === "/account" && /Loyalty points/.test(document.body.innerText)`, 30_000);
      check(Boolean(inAccount), `${label}: signed in, the account page shows loyalty points`);
      check(Boolean(await b.eval(`return /\\b150\\b/.test(document.querySelector("#loyalty")?.innerText ?? "")`)), `${label}: 150 points`);
      await b.clickText("button", "Turn my points into a");
      const made = await b.waitFor(`return /Your voucher is ready/.test(document.body.innerText) ? (document.querySelector("#loyalty")?.innerText.match(/[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}/) ?? [null])[0] : null`, 30_000);
      check(Boolean(made), `${label}: the voucher is made (${made ?? "no code"})`);
      if (!made) return;
      gift = { code: String(made), balance: 150 };
    }
    await b.go(`${BASE}${preorder ? "/e2e-tests/e2e-pre-order-pad" : digital ? "/e2e-tests/e2e-digital-guide" : PRODUCT}`, 1500);
    const title = await b.waitFor(`return document.querySelector("h1")?.textContent?.trim()`, 30_000);
    check(title === (preorder ? "E2E Pre-order Pad" : digital ? "E2E Digital Guide" : "E2E Test Mouse"), `${label}: product page (${title || "no title"})`);
    if (preorder) {
      check(Boolean(await b.waitFor(`return /Pre-order · ships from/.test(document.body.innerText)`, 5000)), `${label}: says pre-order and when it ships`);
      await b.clickText("button", "Pre-order now");
    } else await b.clickText("button", "Add to Cart");
    await b.waitFor(`return localStorage.length > 0 || document.cookie.length > 0`, 5000);
    await new Promise((r) => setTimeout(r, 1200));

    await b.go(`${BASE}/checkout`, 1500);
    check(Boolean(await b.waitFor(`return Boolean(document.querySelector('input[name="phone"]'))`, 60_000)), `${label}: checkout form`);
    const phone = `0300${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
    await b.type('input[name="name"]', "E2E Shopper");
    await b.type('input[name="phone"]', phone);
    // (a signed-in customer's email is filled in already)
    if (await b.eval(`return document.querySelector('input[name="email"]')?.value === ""`)) await b.type('input[name="email"]', "e2e.shopper@example.com");
    // Pakistan: the city is a searchable list; elsewhere a text field
    if (await b.eval(`return Boolean(document.querySelector('[role="combobox"]'))`)) {
      await b.type('[role="combobox"]', "Karachi");
      await b.waitFor(`return [...document.querySelectorAll('[role="option"]')].some((o) => o.textContent.trim() === "Karachi")`, 5000);
      await b.eval(`const o = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === "Karachi"); o.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); o.click(); return true;`);
    } else await b.type('input[name="city"]', "Karachi");
    await b.type('textarea[name="address"]', "House 1, Street 2, Block 3");
    if (preorder) {
      // an invoice for a company (Invoice in another name)
      await b.eval(`document.querySelector('input[name="billingOn"]').click(); return true;`);
      check(Boolean(await b.waitFor(`return Boolean(document.querySelector('input[name="billingCompany"]'))`, 5000)), `${label}: invoice fields open`);
      await b.type('input[name="billingName"]', "Accounts Dept");
      await b.type('input[name="billingCompany"]', "E2E Traders");
      await b.type('input[name="billingTaxId"]', "ntn-7654321");
      await b.type('input[name="billingAddress"]', "Plot 9, Industrial Area");
      await b.type('input[name="billingCity"]', "Karachi");
    }
    if (gift) {
      const box = `document.querySelector('input[placeholder="XXXX-XXXX-XXXX-XXXX"]')`;
      check(Boolean(await b.waitFor(`return Boolean(${box})`, 5000)), `${label}: gift card box shown`);
      // typed the way shoppers do: lower case, spaces
      const card = typeof gift === "object" ? gift : GIFT[gift];
      await b.type('input[placeholder="XXXX-XXXX-XXXX-XXXX"]', card.code.toLowerCase().replace(/-/g, " "));
      await b.eval(`${box}.closest("div").querySelector("button").click(); return true;`);
      const applied = await b.waitFor(`return document.body.innerText.includes("Gift card ••••${card.code.slice(-4)}")`, 15_000);
      check(Boolean(applied), `${label}: the card is applied`);
    }
    const covered = gift === "full";
    if (covered) {
      check(Boolean(await b.waitFor(`return document.body.innerText.includes("Your gift card pays the whole order")`, 5000)), `${label}: nothing else to pay`);
    } else {
      const cod = await b.eval(`return Boolean(document.querySelector('input[name="paymentMethod"][value="cod"]'))`);
      check(cod, `${label}: cash on delivery offered`);
      if (cod) await b.click('label[for$="pm-cod"]');
    }
    await new Promise((r) => setTimeout(r, 800));
    if (gift === "part" || (gift && typeof gift === "object")) {
      const toPay = await b.eval(`return /To pay/.test(document.body.innerText)`);
      check(toPay, `${label}: the summary shows what is left to pay`);
    }
    const sideways = await b.eval(`return document.documentElement.scrollWidth > window.innerWidth + 1`);
    check(!sideways, `${label}: no sideways scrolling on checkout`);
    await b.clickText('button[type="submit"]', "Place order");

    const landed = await b.waitFor(`return location.pathname.startsWith("/order-confirmation/") ? location.pathname : null`, 60_000);
    if (!landed) {
      const why = await b.eval(`return [...document.querySelectorAll('[role="alert"], .text-rose-400, [aria-invalid="true"]')].map((e) => e.textContent || e.getAttribute("name")).filter(Boolean).slice(0, 5)`);
      console.log(`  ${label}: still on ${await b.eval("return location.pathname")}: ${JSON.stringify(why)}`);
    }
    check(Boolean(landed), `${label}: order placed → ${landed || "no confirmation page"}`);
    if (landed) {
      const number = decodeURIComponent(String(landed).split("/").pop());
      const shown = await b.waitFor(`return document.body.innerText.includes(${JSON.stringify(number)}) && /Thank you/i.test(document.body.innerText)`, 20_000);
      check(Boolean(shown), `${label}: thank-you page shows order ${number}`);
      if (gift) {
        const text = String(await b.eval("return document.body.innerText"));
        check(text.includes(`Gift card ••••${(typeof gift === "object" ? gift : GIFT[gift]).code.slice(-4)}`), `${label}: thank-you page shows the gift card`);
        if (gift === "part" || typeof gift === "object") check(/Left to pay/.test(text), `${label}: … and what is left to pay on delivery`);
        else check(/Gift card · Paid/.test(text), `${label}: … and the order is paid`);
      }
      if (digital) {
        const ready = await b.waitFor(`return /Your downloads/.test(document.body.innerText) && document.querySelector('a[href^="/download/"]')?.getAttribute("href")`, 20_000);
        check(Boolean(ready), `${label}: thank-you page has the download (paid with the gift card)`);
        if (ready) {
          const got = await b.eval(`const r = await fetch(${JSON.stringify(ready)}); return r.status + "|" + (r.headers.get("content-disposition") || "") + "|" + (await r.text()).trim();`);
          check(/^200\|attachment; filename="e2e-guide[^"]*"\|ShopEngine E2E digital guide$/.test(String(got)), `${label}: the link downloads the file (${String(got).slice(0, 80)})`);
        }
        // the Delivery row says FREE (nothing to ship)
        check(Boolean(await b.eval(`return document.body.innerText.includes("FREE")`)), `${label}: no delivery charge for a download`);
      }
      if (preorder) {
        const text = String(await b.eval("return document.body.innerText"));
        check(text.includes("Pre-order – ships when released"), `${label}: thank-you page says it ships when released`);
        check(text.includes("Invoice to:") && text.includes("E2E Traders") && text.includes("NTN-7654321"), `${label}: …and who the invoice is for`);
      }
    }
    const errs = b.errors.filter((e) => !/favicon|Failed to load resource|hydrat/i.test(String(e)));
    check(errs.length === 0, `${label}: no page errors${errs.length ? ` (${errs.slice(0, 2).join(" | ")})` : ""}`);
  } finally {
    await b.close();
  }
}

try {
  // E2E_ONLY=desktop,loyalty … runs just those
  const only = (process.env.E2E_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
  const run = (name) => !only.length || only.includes(name);
  if (run("desktop")) await checkout(false);
  if (run("phone")) await checkout(true);
  if (run("gift-part")) await checkout(false, "part");
  if (run("gift-full")) await checkout(false, "full");
  if (run("preorder")) await checkout(false, null, true);
  if (run("loyalty")) await checkout(false, null, false, true);
  // a download, paid at once with the full gift card
  if (run("digital")) await checkout(false, "full", false, false, true);
} catch (e) {
  console.log(`✗ ${e?.message ?? e}`);
  failed++;
}
console.log(failed ? `Browser checkout FAILED (${failed})` : "Browser checkout passed");
process.exit(failed ? 1 : 0);
