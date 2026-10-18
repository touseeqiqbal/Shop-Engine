import "server-only";
import { payloadClient, inStore } from "@/lib/cms/catalog-source";
import type { OrderDownloads } from "@/payload/downloads";

/** An order's digital downloads for its pages (links only once it is paid). Null when it has none. */
export async function downloadsForOrder(orderNumber: string, storeId: number | null): Promise<OrderDownloads | null> {
  const payload = await payloadClient();
  const doc = (await payload.find({ collection: "orders", where: { and: [{ orderNumber: { equals: orderNumber } }, inStore(storeId)] } as never, limit: 1, depth: 0, overrideAccess: true })).docs[0] as unknown as Record<string, unknown> | undefined;
  if (!doc) return null;
  const { orderDownloads } = await import("@/payload/downloads");
  const dl = await orderDownloads(payload, doc);
  return dl.files.length ? dl : null;
}
