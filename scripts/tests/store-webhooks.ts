/**
 * Store webhooks (real database, local receiver): an order status change is delivered once to the store's endpoint,
 * signed with its secret; another store's endpoint gets nothing; a failing endpoint is retried later; private
 * addresses are refused outside development.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/store-webhooks.ts
 */
import { createServer } from "node:http";
import { getPayload } from "payload";
import config from "@payload-config";
import { processOutbox } from "../../src/lib/outbox";
import { isPrivateAddress, signWebhook } from "../../src/lib/webhooks";

const payload = await getPayload({ config });
const sys = { overrideAccess: true, depth: 0, context: { system: true } } as const;
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;

const received: { path: string; body: string; signature: string }[] = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ path: req.url ?? "", body, signature: String(req.headers["shopengine-signature"] ?? "") });
    res.statusCode = req.url === "/broken" ? 500 : 200;
    res.end("ok");
  });
});
await new Promise<void>((r) => server.listen(3199, r));

// test endpoints an interrupted earlier run left behind would receive this run's deliveries too
for (const e of (await payload.find({ collection: "webhook-endpoints", where: { url: { like: "localhost:3199" } }, limit: 100, depth: 0, overrideAccess: true })).docs)
  await payload.delete({ collection: "webhook-endpoints", id: Number(e.id), ...sys }).catch(() => undefined);

const created: { collection: "webhook-endpoints" | "stores"; id: number }[] = [];
try {
  const order = (await payload.find({ collection: "orders", where: { status: { in: ["pending", "confirmed"] } }, sort: "-id", limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  if (!order) throw new Error("No order to test with – place one first");
  const store = Number((order.store as number | Doc | null) && typeof order.store === "object" ? (order.store as Doc).id : order.store);
  const other = (await payload.create({ collection: "stores", data: { name: "Hooks other", slug: `hooks-${Date.now().toString(36)}`, status: "active" } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "stores", id: Number(other.id) });

  const mine = (await payload.create({ collection: "webhook-endpoints", data: { store, url: "http://localhost:3199/mine", events: ["order.updated"], active: true } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "webhook-endpoints", id: Number(mine.id) });
  const theirs = (await payload.create({ collection: "webhook-endpoints", data: { store: other.id, url: "http://localhost:3199/theirs", events: ["order.updated"], active: true } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "webhook-endpoints", id: Number(theirs.id) });
  const broken = (await payload.create({ collection: "webhook-endpoints", data: { store, url: "http://localhost:3199/broken", events: ["order.updated"], active: true } as never, ...sys })) as unknown as Doc;
  created.push({ collection: "webhook-endpoints", id: Number(broken.id) });
  const secret = String(((await payload.findByID({ collection: "webhook-endpoints", id: Number(mine.id), depth: 0, overrideAccess: true, showHiddenFields: true })) as unknown as Doc).secret ?? "");
  check(/^whsec_[0-9a-f]{48}$/.test(secret), "a signing secret was made for the endpoint");

  const next = order.status === "pending" ? "confirmed" : "pending";
  await payload.update({ collection: "orders", id: Number(order.id), data: { status: next } as never, overrideAccess: true, depth: 0 });
  await processOutbox(payload, 100);
  await new Promise((r) => setTimeout(r, 300));

  const toMine = received.filter((r) => r.path === "/mine");
  check(toMine.length === 1, `delivered once to the store's endpoint (${toMine.length})`);
  check(received.every((r) => r.path !== "/theirs"), "another store's endpoint got nothing");
  if (toMine[0]) {
    const event = JSON.parse(toMine[0].body) as { type?: string; data?: Doc };
    check(event.type === "order.updated" && event.data?.orderNumber === order.orderNumber && event.data?.status === next, "the event describes the change");
    const t = Number(/t=(\d+)/.exec(toMine[0].signature)?.[1]);
    check(toMine[0].signature === signWebhook(toMine[0].body, secret, t), "signed with the endpoint's secret");
  }
  const failing = (await payload.find({ collection: "outbox-events", where: { and: [{ type: { equals: "webhook.deliver" } }, { "data.endpointId": { equals: Number(broken.id) } }] } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc | undefined;
  check(failing?.status === "pending" && Number(failing?.attempts) === 1 && /500/.test(String(failing?.lastError)), "a failing endpoint is retried later (backoff)");
  check(isPrivateAddress("10.0.0.5") && isPrivateAddress("169.254.169.254") && isPrivateAddress("::1") && !isPrivateAddress("93.184.216.34"), "private / metadata addresses are recognised");
  // put the order back
  await payload.update({ collection: "orders", id: Number(order.id), data: { status: order.status } as never, overrideAccess: true, depth: 0 });
} finally {
  server.close();
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id, ...sys }).catch((e) => console.warn(`cleanup ${c.collection} ${c.id}: ${(e as Error).message}`));
}
console.log(failed ? `Store webhooks FAILED (${failed})` : "Store webhooks passed");
process.exit(failed ? 1 : 0);
