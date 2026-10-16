/** The solution pages (/solutions/<slug>) – each describes what the platform does today for that kind of business. */

export type Solution = {
  slug: string;
  name: string;
  description: string;
  eyebrow: string;
  title: string;
  lead: string;
  blocks: { title: string; text: string; points: string[] }[];
  note: string;
  features: string[];
};

export const SOLUTIONS: Solution[] = [
  {
    slug: "multi-store",
    name: "Multi-store management",
    description: "Run several independent online stores from one ShopEngine account – each with its own address, catalogue, currency, customers, payment methods and team.",
    eyebrow: "Multi-store management",
    title: "Run every store from one account",
    lead: "Launch separate stores for different brands, markets or price levels – each with its own address, catalogue, currency, customers and team – and switch between them in one admin.",
    blocks: [
      {
        title: "Independent by design",
        text: "Every store is its own business inside ShopEngine. Nothing is shared by accident.",
        points: ["Its own web address, and your own domain on plans that include it", "Its own products, prices, customers and orders", "Its own payment methods, delivery zones and settings"],
      },
      {
        title: "One place to work",
        text: "One sign-in for all of your stores, and one list that shows how each of them is doing.",
        points: ["Store switcher in the admin", "“Your stores” page with each store's plan and status", "Open a store when it's ready – drafts stay hidden from shoppers"],
      },
      {
        title: "Each store in its own market",
        text: "The country you choose for a store sets its currency and time zone, and the payment methods popular there are suggested.",
        points: ["Reports in the store's own currency and time zone", "Local payment methods per store", "Delivery to other countries with zones per country"],
      },
      {
        title: "Teams per store",
        text: "Invite people only to the stores they work on, with the role they need in each.",
        points: ["Owner, manager and staff roles", "Two-step verification for owners and managers", "Activity log of important changes"],
      },
    ],
    note: "An account can own up to three stores by default – ShopEngine can raise the limit on request. Each store is on its own plan.",
    features: ["multi-store", "storefront", "team", "billing"],
  },
  {
    slug: "retail",
    name: "Retail & point of sale",
    description: "Sell at your shop counter and online from one inventory with ShopEngine's point of sale: barcode lookup, split payments, receipts and a daily cash-up.",
    eyebrow: "Retail & point of sale",
    title: "Your shop counter and your website, on one inventory",
    lead: "Sell in person and online from the same products and stock – with barcode lookup, split payments, printed receipts and a daily cash-up.",
    blocks: [
      {
        title: "Fast counter sales",
        text: "Ring up a sale in seconds with the same catalogue your website uses.",
        points: ["Find products by barcode or name", "Split a payment between cash, card and other methods", "Printed receipts"],
      },
      {
        title: "One stock count",
        text: "Every sale takes stock immediately, wherever it happens – so the last unit is never sold twice.",
        points: ["Shared online and in-store inventory", "Low-stock alerts", "Stock returns exactly once when an order is cancelled"],
      },
      {
        title: "Close the day properly",
        text: "Compare the cash you counted with what the system expected, and fix mistakes the same day.",
        points: ["Daily cash-up", "Same-day voids by a manager", "Counter sales included in your sales reports"],
      },
      {
        title: "Returns from either channel",
        text: "Returns and warranty claims follow the same rules whether the sale was online or at the counter.",
        points: ["Returns and warranty claims", "Credit notes", "Printable invoices"],
      },
    ],
    note: "The shop counter is included on plans with the point-of-sale feature – see the pricing page.",
    features: ["pos", "catalog", "orders", "reports"],
  },
  {
    slug: "agencies",
    name: "For agencies",
    description: "Build and look after ShopEngine stores for your clients: each client owns their store and billing, and invites you as a manager to run it.",
    eyebrow: "For agencies",
    title: "Build and look after stores for your clients",
    lead: "Set up storefronts for clients and keep working on them. Each client owns their store, its billing and its data – you get the access they give you.",
    blocks: [
      {
        title: "Client-owned stores",
        text: "The client is the store's owner and holds its plan and payment accounts. If you set a store up for a client, ShopEngine support can hand the ownership over.",
        points: ["One owner per store", "Billing per store, on the client's plan", "The client's payment accounts, not yours"],
      },
      {
        title: "Work across clients",
        text: "Clients invite you as a manager. You switch between their stores in one admin.",
        points: ["Managers handle products, orders, content and settings", "Managers invite the client's staff", "Billing and ownership stay with the owner"],
      },
      {
        title: "Brand each store",
        text: "Give every client a storefront that looks like their business.",
        points: ["Theme colours, fonts and logo", "Page builder, menus and content pages", "The client's own domain on plans that include it"],
      },
      {
        title: "Separate by default",
        text: "One client never sees another client's products, orders or customers.",
        points: ["Store-level data isolation", "Role checks on every action", "Activity log of important changes"],
      },
    ],
    note: "ShopEngine doesn't have a separate agency plan or partner programme today – each client store is on a regular plan.",
    features: ["storefront", "team", "security", "notifications"],
  },
];

export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => s.slug === slug);
