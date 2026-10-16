import type { Payload } from "payload";
import type { Connection } from "./server";

/**
 * What a provider module (lib/integrations/providers/<id>.ts) can do. Every part is optional – a chat widget only
 * has settings, a courier books parcels, a payment provider takes payments …
 */

export type Ctx = { payload: Payload; connection: Connection };

/** A thrown IntegrationError's message is shown to the store's team as it is. */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** What the store's team sees after "Save & test". */
export type TestResult = { ok: true; message: string; state?: Record<string, unknown> } | { ok: false; message: string };

/* ───────────── couriers ───────────── */

export type ParcelInput = {
  orderId: number;
  orderNumber: string;
  /** cash to collect (0 = prepaid) in the order's currency */
  codAmount: number;
  currency: string;
  weightKg: number;
  pieces: number;
  description: string;
  /** items in this parcel (for customs / the label) */
  items: { title: string; qty: number; unitPrice: number; sku?: string | null }[];
  customer: { name: string; phone: string; email?: string | null; address: string; city: string; area?: string | null; postalCode?: string | null; country: string };
  note?: string | null;
  /** the store's choices in the booking window (service type, city id …) */
  options?: Record<string, string>;
};

export type Booking = { trackingNumber: string; labelUrl?: string | null; courierRef?: string | null; courierName: string; raw?: unknown };

export type TrackingStatus = "booked" | "in_transit" | "out_for_delivery" | "delivered" | "returned" | "cancelled" | "failed" | "unknown";
export type Tracking = { status: TrackingStatus; detail: string; at?: string | null; events?: { at: string | null; status: string; location?: string | null }[]; codRemitted?: { amount?: number | null; at?: string | null; ref?: string | null } | null };

export interface CourierImpl {
  /** the courier's name on the order (e.g. "PostEx") */
  name: string;
  /** booking options the team chooses per parcel (service, pickup address …) */
  bookingOptions?(ctx: Ctx): Promise<{ key: string; label: string; options: { label: string; value: string }[]; default?: string }[]>;
  book(ctx: Ctx, parcel: ParcelInput): Promise<Booking>;
  track(ctx: Ctx, trackingNumber: string): Promise<Tracking>;
  cancel?(ctx: Ctx, trackingNumber: string): Promise<void>;
  /** a printable label/airway bill: a URL, or the PDF itself */
  label?(ctx: Ctx, trackingNumber: string): Promise<{ url: string } | { pdf: Buffer }>;
  /** has the courier paid the cash it collected for this parcel to the store? (null = not yet) */
  remittance?(ctx: Ctx, trackingNumber: string): Promise<{ amount?: number | null; at?: string | null; ref?: string | null } | null>;
  trackingUrl?(trackingNumber: string): string;
}

/* ───────────── payments ───────────── */

export type ChargeInput = {
  orderId: number;
  orderNumber: string;
  /** main units (rupees, dollars) */
  total: number;
  /** ISO upper case */
  currency: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  /** the store's own address */
  origin: string;
  /** where the provider sends the shopper back (our /api/integrations/<provider>/<key>/return?o=…) */
  returnUrl: string;
  /** the same with &cancelled=1 – a provider that has a separate cancel address */
  cancelUrl: string;
  /** server-to-server updates (our /api/integrations/<provider>/<key>/webhook) */
  notifyUrl: string;
  /** unique per payment attempt, letters and digits only, ≤ 20 characters ("SE" + order id + time) – for providers that want OUR reference */
  attemptRef: string;
  /** when the payment page should stop taking payments */
  expiresAt: Date;
};

/** What the provider says about a payment (asked by the server – never taken from the browser). */
export type ChargeStatus = {
  state: "paid" | "pending" | "failed";
  /** main units – null when the provider doesn't report it (the amount was fixed in our signed request) */
  amount?: number | null;
  currency?: string | null;
  /** the provider's id of the money movement (capture / payment / transaction) – what refunds need */
  paymentId?: string | null;
  detail?: string;
};

export interface PaymentImpl {
  /**
   * Opens the provider's payment page. `ref` is how we find the payment later (the provider's id, or attemptRef).
   * A provider whose page must be opened with a form POST returns `form` – the shopper's browser posts it to `url`.
   */
  start(ctx: Ctx, input: ChargeInput): Promise<{ url: string; ref: string; form?: Record<string, string> }>;
  /**
   * Asks the provider for the payment's state – with the store's keys, bound to OUR reference (a reference or amount
   * in the shopper's address bar is never believed). `hints`: what came back with the shopper or the update (some
   * providers need an id from it), plus `capture: "1"` when an approved payment may be taken now (PayPal).
   */
  status(ctx: Ctx, ref: string, hints: Record<string, string>, payment: { amount: number; currency: string; createdAt: string }): Promise<ChargeStatus>;
  /** refunds through the provider (unset: the store refunds in the provider's dashboard) */
  refund?(ctx: Ctx, input: { ref: string; paymentId: string | null; amount: number; currency: string; total: number; reason?: string; refundRef: string }): Promise<{ id: string; status: "succeeded" | "pending" | "failed" }>;
  /**
   * A server-to-server update arrived (webhook / IPN / callback): check the provider's signature when it signs them
   * (throw IntegrationError 401 if it doesn't match) and say which payment it is about. ShopEngine then asks the
   * provider itself. `ack` = the answer the provider expects (default 200 "OK").
   */
  notice?(ctx: Ctx, req: { url: URL; headers: Headers; raw: string; params: URLSearchParams }): Promise<{ ref?: string | null; orderNumber?: string | null; hints?: Record<string, string>; ack?: Response }>;
  /** the shopper came back: a provider with a second step returns the next page here (Easypaisa's confirm form) */
  onReturn?(ctx: Ctx, req: { params: URLSearchParams; returnUrl: string }): Promise<Response | null>;
}

/* ───────────── messages ───────────── */

export interface MessagingImpl {
  whatsapp?(ctx: Ctx, to: string, text: string, template?: { name?: string; params: string[] }): Promise<void>;
  sms?(ctx: Ctx, to: string, text: string): Promise<void>;
  email?(ctx: Ctx, mail: { to: string[]; subject: string; html: string; text?: string; replyTo?: string }): Promise<void>;
}

/* ───────────── everything else ───────────── */

/** A store event (order placed / paid / changed, refund, cart left) for providers that want them. */
export type StoreEvent = { type: string; data: Record<string, unknown>; at: string; id: string };

export interface ProviderImpl {
  test?(ctx: Ctx): Promise<TestResult>;
  /** an update the provider sent to the store's address (webhook, IPN, return page) */
  inbound?(ctx: Ctx, req: { method: string; url: URL; headers: Headers; raw: string; action: string }): Promise<Response>;
  /** a store event it listed in the catalog (`events`) – sent through the outbox, retried */
  onEvent?(ctx: Ctx, event: StoreEvent): Promise<void>;
  /** periodic work (housekeeping, about every 30 minutes): sync stock, refresh tokens … */
  sync?(ctx: Ctx): Promise<string | null>;
  courier?: CourierImpl;
  payment?: PaymentImpl;
  messaging?: MessagingImpl;
  /** OAuth: the provider's sign-in page, and finishing the connection with its code */
  oauth?: {
    configured(): boolean;
    authorizeUrl(input: { state: string; redirectUri: string; country: string; options: Record<string, string> }): string;
    finish(ctx: { payload: Payload; storeId: number }, input: { code: string; redirectUri: string; params: URLSearchParams; options: Record<string, string> }): Promise<{ secrets: Record<string, string>; state: Record<string, unknown>; config?: Record<string, unknown> }>;
  };
}
