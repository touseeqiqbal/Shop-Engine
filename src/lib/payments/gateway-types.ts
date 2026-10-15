import type { Payload, PayloadRequest } from "payload";
import type { GatewayInfo } from "./catalog";

/** What a payment provider plugin implements – see lib/payments/gateways.ts and docs/PAYMENT-PLUGINS.md. */

type Doc = Record<string, unknown>;

export class GatewayError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type StartPaymentInput = {
  orderId: number;
  orderNumber: string;
  /** in the currency's main unit (rupees, dollars) */
  total: number;
  /** ISO, upper case – the order's currency */
  currency: string;
  storeId: number;
  email?: string | null;
  /** the store's own address, for the return links */
  origin: string;
};

export type WebhookEvent = { id: string; type: string; data: unknown };
export type WebhookResult = { status: "processed" | "ignored"; store?: number | null; summary: Doc };

export interface PaymentGateway extends GatewayInfo {
  /** the platform's keys for this provider are set */
  configured(): boolean;
  /** this store's connected account can take payments now */
  ready(store: Doc): boolean;
  /** opens the provider's payment page for a just-placed order (records a pending charge) */
  start(payload: Payload, input: StartPaymentInput): Promise<{ url: string }>;
  /** the still-open payment page of an order waiting for payment (to send the shopper back) */
  resumeUrl(payload: Payload, orderId: number): Promise<string | null>;
  /** checks a webhook's signature; throws GatewayError when it isn't the provider's */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent;
  /** does the work for one verified event (mark paid, cancel, account updates …) */
  handleWebhook(payload: Payload, event: WebhookEvent): Promise<WebhookResult>;
  /** refunds (part of) an order's payment through the provider */
  refund(payload: Payload, req: PayloadRequest, input: { orderId: number; amount: number; reason?: string }): Promise<{ status: string; refunded: number }>;
  /** settles payments whose webhook never came (housekeeping) */
  reconcile?(payload: Payload, limit?: number): Promise<{ paid: number; cancelled: number }>;
  /** where the owner connects (or finishes connecting) the store's account */
  connectLink?(payload: Payload, input: { storeId: number; email?: string | null; country?: string | null; returnUrl: string }): Promise<string>;
  /** re-reads whether the store's account can take payments */
  refreshAccount?(payload: Payload, storeId: number): Promise<boolean>;
}
