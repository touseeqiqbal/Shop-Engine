import { http } from "../http";
import { intlDigits } from "@/lib/phone";
import type { Ctx, ProviderImpl } from "../types";
import { IntegrationError } from "../types";

/**
 * The store's own WhatsApp Business number (Cloud API). Messages to customers who haven't written in the last 24 hours
 * must use an approved template – notify.ts picks the store's template names for each kind of message.
 */

export const WHATSAPP_VERSION = "v25.0";
const graph = (path: string) => `https://graph.facebook.com/${WHATSAPP_VERSION}/${path}`;

type GraphError = { error?: { message?: string; code?: number; error_data?: { details?: string } } };

async function send(ctx: Ctx, to: string, text: string, template?: { name?: string; params: string[] }) {
  const { phoneNumberId, language } = ctx.connection.config;
  const recipient = `+${to.replace(/^\+/, "")}`;
  const body = template?.name
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: { name: template.name, language: { code: String(language || "en") }, components: [{ type: "body", parameters: template.params.map((p) => ({ type: "text", text: String(p).slice(0, 1000) })) }] },
      }
    : { messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "text", text: { preview_url: true, body: text.slice(0, 4096) } };
  const r = await http<GraphError & { messages?: { id: string }[] }>(graph(`${encodeURIComponent(String(phoneNumberId))}/messages`), { provider: "WhatsApp", method: "POST", headers: { authorization: `Bearer ${ctx.connection.secrets.accessToken ?? ""}` }, body });
  if (!r.ok) {
    const e = r.data.error;
    // outside the 24-hour window a plain text can't be delivered – a template is needed (not worth retrying)
    if (e?.code === 131047) throw new IntegrationError("WhatsApp: the customer hasn’t messaged you in the last 24 hours, so only an approved template can be sent.", 400);
    throw new Error(`WhatsApp ${r.status}: ${e?.message ?? "not sent"}${e?.error_data?.details ? ` – ${e.error_data.details}` : ""}`);
  }
}

const impl: ProviderImpl = {
  async test(ctx) {
    const r = await http<GraphError & { display_phone_number?: string; verified_name?: string }>(graph(`${encodeURIComponent(String(ctx.connection.config.phoneNumberId))}?fields=display_phone_number,verified_name`), { provider: "WhatsApp", headers: { authorization: `Bearer ${ctx.connection.secrets.accessToken ?? ""}` } });
    if (!r.ok) return { ok: false, message: `WhatsApp: ${r.data.error?.message ?? "the phone number id or token isn’t right"}` };
    const account = `${r.data.verified_name ?? "WhatsApp"} (${r.data.display_phone_number ?? ctx.connection.config.phoneNumberId})`;
    const testTo = String(ctx.connection.config.testNumber ?? "").trim();
    if (testTo) {
      try {
        await send(ctx, intlDigits(testTo, "PK"), "Test message from your store on ShopEngine – WhatsApp is connected.");
      } catch (e) {
        return { ok: true, message: `Connected to ${account}. The test message wasn’t delivered: ${(e as Error).message}`, state: { account } };
      }
      return { ok: true, message: `Connected to ${account}. A test message was sent to ${testTo}.`, state: { account } };
    }
    return { ok: true, message: `Connected to ${account}.`, state: { account } };
  },
  messaging: { whatsapp: (ctx, to, text, template) => send(ctx, to, text, template) },
};

export default impl;
