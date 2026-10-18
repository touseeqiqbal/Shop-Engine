/**
 * Courier tracking selection (real database):
 *  - finished parcels (delivered + cash paid out, or not cash on delivery) are no longer picked for tracking – they
 *    used to fill the 200 oldest places for good, and then no new parcel was tracked again on any store;
 *  - a parcel on its way and a delivered parcel whose cash is still owed are picked;
 *  - a parcel whose courier can't be asked (not connected) is put back for later, not kept at the front.
 * Creates its own orders and removes them afterwards.
 *
 *   node --conditions=react-server node_modules/payload/bin.js run scripts/tests/courier-sync.ts
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { syncCourierTracking, TRACKABLE_ORDERS } from "../../src/lib/integrations/couriers";

const payload = await getPayload({ config });
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};
type Doc = Record<string, unknown>;
const tag = Date.now().toString(36).toUpperCase();
const store = Number(((await payload.find({ collection: "stores", where: { isDefault: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Doc).id);
const longAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
const ids: number[] = [];

const order = async (name: string, status: string, shipment: Doc) => {
  const doc = (await payload.create({
    collection: "orders",
    data: {
      store,
      orderNumber: `CRS-${tag}-${name}`,
      placedAt: longAgo,
      status,
      customer: { name: "Courier Test", phone: "0300-1112223", city: "Karachi", address: "Street 1, Block 2" },
      items: [{ title: "Mouse", qty: 1, unitPrice: 1000 }],
      subtotal: 1000,
      total: 1000,
      paymentMethod: "cod",
      paymentStatus: status === "delivered" ? "paid" : "unpaid",
      // a provider no store has connected: asking it fails (like a disconnected courier account)
      shipments: [{ items: [{ line: 0, qty: 1 }], courier: "Test courier", provider: "no-such-courier", trackingNumber: `TN${tag}${name}`, shippedAt: longAgo, lastTrackedAt: longAgo, ...shipment }],
    } as never,
    overrideAccess: true,
    depth: 0,
    context: { migrating: true },
  })) as unknown as Doc;
  ids.push(Number(doc.id));
  return Number(doc.id);
};

try {
  const done1 = await order("DONE1", "delivered", { status: "delivered", deliveredAt: longAgo, codAmount: 1000, codStatus: "remitted" });
  const done2 = await order("DONE2", "delivered", { status: "delivered", deliveredAt: longAgo, codAmount: 0, codStatus: null });
  const onWay = await order("ONWAY", "dispatched", { status: "shipped", codAmount: 1000, codStatus: "pending" });
  const owed = await order("OWED", "delivered", { status: "delivered", deliveredAt: longAgo, codAmount: 1000, codStatus: "pending" });

  const picked = (await payload.find({ collection: "orders", where: { and: [TRACKABLE_ORDERS, { id: { in: ids } }] }, limit: 10, depth: 0, overrideAccess: true })).docs.map((d) => Number((d as unknown as Doc).id));
  check(!picked.includes(done1) && !picked.includes(done2), `finished parcels aren't picked any more (${picked.length} of ${ids.length} picked)`);
  check(picked.includes(onWay) && picked.includes(owed), "a parcel on its way and one whose cash is still owed are picked");

  // the courier can't be asked: the parcel is put back for later (its "asked" time moves), the order moves back in line
  const before = (await payload.findByID({ collection: "orders", id: onWay, depth: 0, overrideAccess: true })) as unknown as Doc;
  await syncCourierTracking(payload, 40);
  const after = (await payload.findByID({ collection: "orders", id: onWay, depth: 0, overrideAccess: true })) as unknown as Doc;
  const tracked = (o: Doc) => String(((o.shipments as Doc[])?.[0] ?? {}).lastTrackedAt ?? "");
  check(Date.parse(tracked(after)) > Date.parse(tracked(before)), "a parcel whose courier can't be asked is put back for later, not kept at the front");
  check(String(after.status) === "dispatched" && ((after.shipments as Doc[])?.[0] as Doc)?.status === "shipped", "…and nothing else about it changes");
} catch (e) {
  console.error(e);
  failed++;
} finally {
  for (const id of ids) await payload.delete({ collection: "orders", id, overrideAccess: true, context: { migrating: true, system: true } }).catch((e) => console.error("cleanup:", (e as Error).message));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll courier sync checks passed");
process.exit(failed ? 1 : 0);
