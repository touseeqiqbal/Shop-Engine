// A tiny headless-Chrome driver over the DevTools protocol – no packages: Node's own WebSocket + a Chrome/Chromium
// on the machine (CHROME_PATH, else the usual install places; GitHub's ubuntu runners have google-chrome).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9555, width = 1280, height = 900, mobile = false } = {}) {
  const bin = CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error("No Chrome found – set CHROME_PATH");
  const profile = mkdtempSync(path.join(tmpdir(), "e2e-chrome-"));
  const proc = spawn(bin, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--no-sandbox", `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });
  let target;
  // up to a minute: a busy machine (or CI runner) can be slow to start a browser
  for (let i = 0; i < 240 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${port}/json/list`)
      .then((r) => r.json())
      .then((l) => l.find((t) => t.type === "page"))
      .catch(() => undefined);
  }
  if (!target) throw new Error("Chrome didn't start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
    else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  // every call gives up after a while: a page stuck loading (a slow dev compile) must not hang the whole test
  const send = (method, params = {}, timeoutMs = 120_000) =>
    new Promise((res, rej) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        rej(new Error(`${method} timed out`));
      }, timeoutMs);
      pending.set(id, { res: (v) => (clearTimeout(timer), res(v)), rej: (e) => (clearTimeout(timer), rej(e)) });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable");
  await send("Page.enable");
  if (mobile) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  /** Runs a function body in the page and returns its (JSON) result. */
  const evaluate = async (body) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true }, 30_000);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const b = {
    errors,
    send,
    eval: evaluate,
    async go(url, settleMs = 1500) {
      await send("Page.navigate", { url }).catch((e) => errors.push(`navigate: ${e.message}`));
      await b.waitFor(`return document.readyState === "complete"`, 60_000);
      await sleep(settleMs);
    },
    /** Waits until the body returns something truthy; returns it (or false after the timeout). */
    async waitFor(body, timeoutMs = 20_000) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const v = await evaluate(body).catch(() => null);
        if (v) return v;
        await sleep(250);
      }
      return false;
    },
    async click(selector) {
      const ok = await evaluate(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;`);
      if (!ok) throw new Error(`no ${selector}`);
    },
    async clickText(selector, text) {
      const ok = await evaluate(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim().includes(${JSON.stringify(text)}) && !e.disabled); if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;`);
      if (!ok) throw new Error(`no ${selector} with ${text}`);
    },
    /** Types into a field like a person (React sees the input events). */
    async type(selector, text) {
      await evaluate(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("no ${selector.replace(/"/g, "'")}"); el.scrollIntoView({ block: "center" }); el.focus(); if (el.select) el.select();`);
      await send("Input.insertText", { text });
    },
    async screenshot() {
      return Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64");
    },
    async close() {
      try {
        ws.close();
      } catch {}
      proc.kill();
      await sleep(500);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
  return b;
}
