import type { IntegrationInfo } from "../catalog-types";

/**
 * Accounting: each sale goes to the store's own accounting company once the money is in – paid online, or the order
 * delivered (cash collected). Connected with the provider's sign-in page (ShopEngine's app – lib/integrations/oauth.ts).
 * Refunds made through ShopEngine (online payments) follow as a refund receipt / credit note; refunds handled outside
 * (cash returned at the counter, Orders → Returns) are recorded in the accounting software by the store.
 */

const after = "After connecting, every paid online order – and every delivered order – is added as a sale, and refunds of online payments follow. Orders from before connecting are not sent.";

export const ACCOUNTING: IntegrationInfo[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    summary: "Each paid or delivered order is added to QuickBooks as a sales receipt.",
    oauth: true,
    steps: ["Click “Connect with QuickBooks” and sign in to the QuickBooks company this store’s sales belong to.", "Sales are booked to a service item named below (made for you if it doesn’t exist).", after],
    fields: [{ key: "itemName", label: "QuickBooks item for sales", type: "text", default: "ShopEngine sales", help: "Every order line is booked to this item (its income account is used)." }],
    minRole: "store_owner",
    exclusive: "accounting",
    verified: false,
    docsUrl: "https://quickbooks.intuit.com/",
    color: "#2ca01c",
    events: ["order.paid", "order.updated", "refund.created"],
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    summary: "Each paid or delivered order becomes an approved Xero invoice – with its payment, if you choose a bank account.",
    oauth: true,
    steps: [
      "Click “Connect with Xero” and choose the Xero organisation for this store.",
      "Sales go to the account code below (200 = Sales in Xero’s standard chart). Enter your bank account’s code to mark invoices as paid too.",
      after,
    ],
    fields: [
      { key: "salesAccount", label: "Sales account code", type: "text", default: "200" },
      { key: "paymentAccount", label: "Bank account code for payments (optional)", type: "text", help: "e.g. 090 – leave empty to leave invoices open." },
      { key: "taxType", label: "Tax type", type: "text", default: "NONE", help: "A Xero tax type valid in your region (NONE = no tax)." },
      { key: "contactName", label: "Contact for shop sales", type: "text", default: "Online shop customers" },
    ],
    minRole: "store_owner",
    exclusive: "accounting",
    verified: false,
    docsUrl: "https://www.xero.com/",
    color: "#13b5ea",
    events: ["order.paid", "order.updated", "refund.created"],
  },
];
