import type { Endpoint } from "payload";
import { storeGate } from "./guard";
import { funnelFor } from "../shop-stats";
import { storeLocaleOf } from "../store-locale";
import { addDays, dayIn } from "../../lib/time";

/** GET /cms-api/shop-funnel?days=30 – product views → add to cart → checkout → orders for the store (managers). */
export const shopFunnelEndpoint: Endpoint = {
  path: "/shop-funnel",
  method: "get",
  handler: async (req) => {
    const gate = await storeGate(req, "store_manager");
    if (gate instanceof Response) return gate;
    const days = Math.min(365, Math.max(1, Math.floor(Number(new URL(req.url ?? "http://x", "http://x").searchParams.get("days")) || 30)));
    const loc = await storeLocaleOf(req.payload, gate.store, req);
    const to = dayIn(Date.now(), loc.timezone);
    const from = addDays(to, -(days - 1));
    return Response.json(await funnelFor(req.payload, gate.store, from, to, loc.timezone), { headers: { "Cache-Control": "no-store" } });
  },
};
