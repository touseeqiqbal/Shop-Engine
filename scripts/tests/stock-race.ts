/**
 * Overselling test: BUYERS shoppers (default 10) try to take 1 unit of a product that has STOCK in stock
 * (default 2), all at the same moment. Exactly STOCK must succeed and stock must end at 0.
 * The product's stock is restored afterwards.
 *
 *   npm run test:stock                         (local or staging DATABASE_URL – never run against production)
 *   BUYERS=200 STOCK=20 npm run test:stock     (sale-day rush)
 */
import { getPayload } from "payload";
import config from "@payload-config";
import { putBackStock, setStock, takeStock } from "../../src/payload/stock";

const payload = await getPayload({ config });
const { docs } = await payload.find({ collection: "products", limit: 1, depth: 0, overrideAccess: true, sort: "id" });
const p = docs[0] as { id: number; stock?: number; soldCount?: number; title: string };
if (!p) throw new Error("No products to test with");
const before = { stock: Number(p.stock ?? 0), sold: Number(p.soldCount ?? 0) };

let failed = false;
try {
  const buyers = Number(process.env.BUYERS) || 10;
  const stock = Number(process.env.STOCK) || 2;
  await setStock(payload, p.id, stock);
  const t = Date.now();
  const results = await Promise.all(Array.from({ length: buyers }, () => takeStock(payload, p.id, 1)));
  const wins = results.filter((r) => r !== null).length;
  const after = (await payload.findByID({ collection: "products", id: p.id, depth: 0, overrideAccess: true })) as { stock?: number; stockStatus?: string };
  const ok = wins === stock && Number(after.stock) === 0 && after.stockStatus === "out";
  console.log(`${ok ? "✓" : "✗"} ${buyers} buyers, ${stock} in stock → ${wins} sold, stock now ${after.stock} (${after.stockStatus}) in ${Date.now() - t} ms`);
  failed ||= !ok;

  await putBackStock(payload, p.id, 2);
  const back = (await payload.findByID({ collection: "products", id: p.id, depth: 0, overrideAccess: true })) as { stock?: number };
  const ok2 = Number(back.stock) === 2;
  console.log(`${ok2 ? "✓" : "✗"} putting 2 back → stock ${back.stock}`);
  failed ||= !ok2;
} finally {
  await setStock(payload, p.id, before.stock);
  await payload.update({ collection: "products", id: p.id, data: { soldCount: before.sold } as never, overrideAccess: true, depth: 0, context: { skipRevalidate: true } });
}
console.log(failed ? "Stock race test FAILED" : "Stock race test passed");
process.exit(failed ? 1 : 0);
