import type { Payload } from "payload";
import { integrationInfo } from "./catalog";
import { providerImpl } from "./providers";
import { runSync, type Connection } from "./server";
import { log } from "@/lib/log";

/**
 * Periodic work of integrations that have it (ProviderImpl.sync): marketplace stock and prices, refreshing tokens …
 * Each connection runs on its own; a failure is noted on the connection ("Needs attention") and retried next time.
 */
export async function runIntegrationSyncs(payload: Payload, limit = 25): Promise<string[]> {
  const docs = (await payload.find({ collection: "integrations" as never, where: { and: [{ enabled: { equals: true } }, { status: { equals: "connected" } }] }, limit: 500, depth: 0, overrideAccess: true })).docs as unknown as { store: unknown; provider: string }[];
  const done: string[] = [];
  for (const d of docs) {
    if (done.length >= limit) break;
    const impl = await providerImpl(d.provider);
    if (!impl?.sync || !integrationInfo(d.provider)) continue;
    const { getConnection } = await import("./server");
    const storeId = Number(d.store && typeof d.store === "object" ? (d.store as { id: unknown }).id : d.store);
    const c = (await getConnection(payload, storeId, d.provider, { fresh: true })) as Connection | null;
    if (!c) continue;
    const r = await runSync(payload, c, (ctx) => impl.sync!(ctx));
    if (r.error) log.warn("integrations.sync_failed", { provider: c.provider, store: c.store, error: r.error });
    else if (r.summary) done.push(`${c.provider}#${c.store}: ${r.summary}`);
  }
  return done;
}
