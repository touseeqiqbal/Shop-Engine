/**
 * Partial shipments (real database): ship part of an order → "Partly shipped" and a message for that parcel; ship the
 * rest → "Dispatched"; more than ordered is refused; parcels delivered → order delivered; another store can't ship it.
 * Creates its own test order and removes it afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/shipments.ts
 */
import { getPayload, type PayloadRequest } from "payload";
import config from "@payload-config";
import { orderToolEndpoints } from "../../src/payload/endpoints/orders";

const payload = await getPayload({ config });
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const endpoint = (path: string) => orderToolEndpoints.find((e) => e.path === path)!;
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
// any existing account stands in for the staff member (the activity log links to it)
const staffId = Number(((await payload.find({ collection: "users", limit: 1, depth: 0, overrideAccess: true, sort: "id" })).docs[0] as unknown as Doc).id);
const asStaff = (storeId: number, body: unknown) =>
  ({
    payload,
    user: { id: staffId, collection: "users", email: "staff@test.local", twoFactor: { enabled: true } },
    url: "http://x/",
    json: async () => body,
    context: { __shopengineTenant: { userId: staffId, tenant: { userId: staffId, platformAdmin: false, roles: new Map([[storeId, "store_staff"]]), activeStoreId: storeId, defaultStoreId: store, readOnly: new Set() } } },
  }) as unknown as PayloadRequest;
const call = async (path: string, storeId: number, body: unknown) => {
  const res = (await endpoint(path).handler(asStaff(storeId, body))) as Response;
  return { status: res.status, json: (await res.json()) as Doc };
};
const read = async (id: number) => (await payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true })) as unknown as Doc;

const order = (await payload.create({
  collection: "orders",
  data: {
    store,
    orderNumber: `SHP-${Date.now().toString(36).toUpperCase()}`,
    placedAt: new Date().toISOString(),
    status: "confirmed",
    customer: { name: "Parcel Test", phone: "0300-1112223", city: "Karachi", address: "Street 1, Block 2" },
    items: [
      { title: "Mouse", qty: 2, unitPrice: 1000 },
      { title: "Keyboard", qty: 1, unitPrice: 3000 },
    ],
    subtotal: 5000,
    total: 5000,
    paymentMethod: "cod",
    paymentStatus: "unpaid",
  } as never,
  overrideAccess: true,
  depth: 0,
  context: { migrating: true },
})) as unknown as Doc;
const id = Number(order.id);
try {
  let r = await call("/order-tools/ship", store, { orderId: id, lines: [{ line: 0, qty: 3 }] });
  check(r.status === 400, "can't ship more than was ordered");
  r = await call("/order-tools/ship", store + 100000, { orderId: id, lines: [{ line: 0, qty: 1 }] });
  check(r.status === 404, "another store's team can't ship it");

  r = await call("/order-tools/ship", store, { orderId: id, lines: [{ line: 0, qty: 1 }], courier: "TCS", trackingNumber: "T-1" });
  let o = await read(id);
  check(r.status === 200 && o.fulfillmentStatus === "partially_fulfilled" && o.status === "confirmed", `first parcel → partly shipped (${o.status}/${o.fulfillmentStatus})`);
  const parcelMsg = await payload.count({ collection: "outbox-events", where: { and: [{ type: { equals: "notify.shipment" } }, { "data.orderId": { equals: id } }] } as never, overrideAccess: true });
  check(parcelMsg.totalDocs === 1, "the customer gets a message for that parcel");

  r = await call("/order-tools/ship", store, { orderId: id, lines: [{ line: 0, qty: 1 }, { line: 1, qty: 1 }], courier: "Leopards", trackingNumber: "L-2" });
  o = await read(id);
  check(r.json.complete === true && o.status === "dispatched" && o.trackingNumber === "L-2", `rest shipped → dispatched (${o.status}, ${String(o.trackingNumber)})`);

  await call("/order-tools/shipment", store, { orderId: id, index: 0, status: "delivered" });
  o = await read(id);
  check(o.status === "dispatched", "one parcel delivered – order still on its way");
  await call("/order-tools/shipment", store, { orderId: id, index: 1, status: "delivered" });
  o = await read(id);
  check(o.status === "delivered" && o.fulfillmentStatus === "delivered", `all parcels delivered → order delivered (${o.status})`);
} finally {
  await payload.delete({ collection: "orders", id, overrideAccess: true, context: { migrating: true, skipStock: true } }).catch((e) => console.warn(`cleanup: ${(e as Error).message}`));
}
console.log(failed ? `Shipments FAILED (${failed})` : "Shipments passed");
process.exit(failed ? 1 : 0);
