/** Types of the integrations catalog (client-safe). */

export type IntegrationCategory = "shipping" | "payments" | "messaging" | "marketing" | "email-marketing" | "accounting" | "chat" | "marketplaces";

export const CATEGORIES: { id: IntegrationCategory; label: string; description: string }[] = [
  { id: "shipping", label: "Couriers & shipping", description: "Book parcels, print labels and follow deliveries without copying tracking numbers by hand." },
  { id: "payments", label: "Online payments", description: "Take payments online through your own account with a local or global payment provider." },
  { id: "messaging", label: "WhatsApp, SMS & email", description: "Send order messages from your own WhatsApp number, SMS sender and email domain." },
  { id: "marketing", label: "Ads & analytics", description: "Measure visits and sales, and send purchases to your ad accounts." },
  { id: "email-marketing", label: "Email marketing", description: "Keep your subscribers and customers in sync with your email marketing tool." },
  { id: "accounting", label: "Accounting", description: "Send paid orders to your accounting software automatically." },
  { id: "chat", label: "Live chat", description: "Chat with shoppers on your store." },
  { id: "marketplaces", label: "Marketplaces", description: "Keep prices and stock in step with your marketplace listings." },
];

export type FieldType = "text" | "secret" | "select" | "checkbox" | "textarea";

export interface IntegrationField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  default?: string;
  /** a choice made before signing in with the provider's page (e.g. Amazon's marketplace) – select fields only */
  beforeConnect?: boolean;
}

export interface IntegrationInfo {
  id: string;
  name: string;
  category: IntegrationCategory;
  /** one line on the card */
  summary: string;
  /** shown in the connect window: where to find the keys, what happens after connecting */
  steps?: string[];
  /** ISO country codes it works in (unset = everywhere) */
  countries?: readonly string[];
  /** settings the store enters; "secret" fields are stored encrypted */
  fields: IntegrationField[];
  /** has a test (sandbox) and a live mode */
  modes?: boolean;
  /** the provider sends updates to the store's own address (shown to copy into the provider's dashboard) */
  webhook?: string;
  /** connected with a "Connect" button (the provider's sign-in page) instead of pasted keys */
  oauth?: boolean;
  /** who may connect it: owners for money and sending identity, managers for the rest */
  minRole: "store_manager" | "store_owner";
  /** the plan feature it needs (lib/billing PlanFeature) */
  planFeature?: "online_payments" | "custom_domain" | "pos" | "reports" | "discounts" | "abandoned_carts";
  /** only one of each group can be switched on (e.g. one email sender) */
  exclusive?: string;
  /** checked against the provider's live or test system by ShopEngine – false shows "New" so owners test first */
  verified: boolean;
  docsUrl?: string;
  /** brand colour for the card's initial */
  color?: string;
  /** payment providers: what the checkout needs to know (lib/integrations/payments.ts) */
  payment?: {
    /** currencies it charges, ISO upper case (unset = any the provider account takes) */
    currencies?: readonly string[];
    /** the provider needs the shopper's email */
    needsEmail?: boolean;
    /** refunds go through the provider from the order in /cms (else: in the provider's dashboard) */
    refunds?: boolean;
    /** the checkout icon */
    icon: "card" | "wallet";
    /** the name shoppers see at checkout (default: the integration's name) */
    label?: string;
  };
  /** store events it receives (lib/webhooks.ts emitStoreEvent) */
  events?: readonly ("order.created" | "order.updated" | "order.paid" | "refund.created" | "checkout.started")[];
}
