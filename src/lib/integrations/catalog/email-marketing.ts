import type { IntegrationInfo } from "../catalog-types";

/** Email marketing tools: customers who agreed to marketing emails are kept in sync, and orders / carts are sent as events. */
export const EMAIL_MARKETING: IntegrationInfo[] = [
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email-marketing",
    summary: "Add customers who agree to marketing emails to your Mailchimp audience, tagged by what they did.",
    steps: [
      "In Mailchimp → Profile → Extras → API keys, create a key (it ends in your data centre, e.g. “-us21”).",
      "Audience → Settings → Audience name and defaults: copy the Audience ID.",
      "Only customers who ticked “email me news and offers” are added; they are tagged “Customer” after an order.",
    ],
    fields: [
      { key: "apiKey", label: "API key", type: "secret", required: true },
      { key: "audienceId", label: "Audience ID", type: "text", required: true, placeholder: "a1b2c3d4e5" },
      { key: "doubleOptIn", label: "Send Mailchimp’s confirmation email first (double opt-in)", type: "checkbox" },
    ],
    minRole: "store_manager",
    exclusive: "email-marketing",
    verified: false,
    docsUrl: "https://mailchimp.com/developer/marketing/api/list-members/",
    color: "#e8c600",
    events: ["order.created", "order.paid"],
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "email-marketing",
    summary: "Sync subscribers and send “Placed Order” and “Started Checkout” events for your flows.",
    steps: [
      "In Klaviyo → Settings → API keys, create a private key with Profiles, Lists, Events and Subscriptions access.",
      "Lists & segments → your list → Settings: copy the List ID.",
      "Build your abandoned-cart and post-purchase flows in Klaviyo on the “Started Checkout” and “Placed Order” metrics.",
    ],
    fields: [
      { key: "privateKey", label: "Private API key", type: "secret", required: true, placeholder: "pk_…" },
      { key: "listId", label: "List ID", type: "text", required: true, placeholder: "AbC123" },
    ],
    minRole: "store_manager",
    exclusive: "email-marketing",
    verified: false,
    docsUrl: "https://developers.klaviyo.com/en/reference/api_overview",
    color: "#232426",
    events: ["order.created", "order.paid", "checkout.started"],
  },
];
