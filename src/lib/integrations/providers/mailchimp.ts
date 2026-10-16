import { createHash } from "node:crypto";
import { http, httpOk } from "../http";
import { loadOrder, normEmail } from "../order-data";
import type { Ctx, ProviderImpl, StoreEvent } from "../types";
import { IntegrationError } from "../types";

/**
 * Mailchimp: customers who ticked "email me news and offers" at checkout are added to (or updated in) the store's
 * audience and tagged "Customer". Nobody else is ever added.
 */

function base(ctx: Ctx) {
  const key = ctx.connection.secrets.apiKey ?? "";
  const dc = key.split("-")[1];
  if (!dc || !/^[a-z]+\d+$/.test(dc)) throw new IntegrationError("Mailchimp: the API key should end with your data centre, e.g. “-us21”.");
  return { url: `https://${dc}.api.mailchimp.com/3.0`, auth: `Basic ${Buffer.from(`shopengine:${key}`).toString("base64")}` };
}

async function onEvent(ctx: Ctx, event: StoreEvent) {
  if (event.type !== "order.created" && event.type !== "order.paid") return;
  const order = await loadOrder(ctx.payload, Number(event.data.id));
  const email = normEmail(order?.customer.email);
  if (!order || !order.marketingConsent || !email) return;
  const { url, auth } = base(ctx);
  const list = encodeURIComponent(String(ctx.connection.config.audienceId));
  const hash = createHash("md5").update(email).digest("hex");
  const [first, ...rest] = order.customer.name.trim().split(/\s+/);
  await httpOk(`${url}/lists/${list}/members/${hash}`, {
    provider: "Mailchimp",
    method: "PUT",
    headers: { authorization: auth },
    body: {
      email_address: email,
      // a new member: subscribed straight away, or "pending" so Mailchimp asks them to confirm; an existing one keeps theirs
      status_if_new: ctx.connection.config.doubleOptIn === true ? "pending" : "subscribed",
      merge_fields: { FNAME: first ?? "", LNAME: rest.join(" ") },
    },
  });
  await httpOk(`${url}/lists/${list}/members/${hash}/tags`, { provider: "Mailchimp", method: "POST", headers: { authorization: auth }, body: { tags: [{ name: "Customer", status: "active" }] } });
}

const impl: ProviderImpl = {
  async test(ctx) {
    const { url, auth } = base(ctx);
    const r = await http<{ id?: string; name?: string; detail?: string }>(`${url}/lists/${encodeURIComponent(String(ctx.connection.config.audienceId))}?fields=id,name`, { provider: "Mailchimp", headers: { authorization: auth } });
    if (!r.ok) return { ok: false, message: `Mailchimp: ${r.data.detail ?? "the API key or audience id isn’t right"}` };
    return { ok: true, message: `Connected to the audience “${r.data.name}”. Customers who agree to marketing emails will be added.`, state: { account: r.data.name } };
  },
  onEvent,
};

export default impl;
