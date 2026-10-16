/**
 * ShopEngine marketing copy in one place – every claim here matches what the platform actually does (see
 * audit-reports/11-remediation-log.md). Planned work is listed separately and labelled as planned on the pages.
 */

export const SITE = {
  name: "ShopEngine",
  tagline: "One platform. Every store. Total control.",
  description:
    "ShopEngine is a multi-store ecommerce platform: launch and run independent online stores – products, orders, payments, teams and billing – from one place.",
  // existing app paths (merchant accounts live under /account on this same address)
  signUp: "/account/register?next=%2Faccount%2Fstores",
  signIn: "/account/login?next=%2Faccount%2Fstores",
  stores: "/account/stores",
  admin: "/cms",
} as const;

export type IconName =
  | "Store"
  | "Palette"
  | "Boxes"
  | "ClipboardList"
  | "CreditCard"
  | "Truck"
  | "UsersRound"
  | "ScanBarcode"
  | "ChartNoAxesCombined"
  | "BadgeCheck"
  | "BellRing"
  | "ShieldCheck";

export type Feature = { id: string; icon: IconName; title: string; text: string; points: string[] };

export const FEATURES: Feature[] = [
  {
    id: "multi-store",
    icon: "Store",
    title: "Multi-store management",
    text: "Run several independent shops from one account. Each store has its own products, customers, orders, settings and web address.",
    points: ["Switch between stores in the admin", "Up to three stores per account by default (raised by ShopEngine on request)", "Each store's data stays separate"],
  },
  {
    id: "storefront",
    icon: "Palette",
    title: "Storefront customization",
    text: "Shape each store's look and content: theme colours and fonts, logo, header and footer menus, pages, categories and collections.",
    points: ["Theme settings and page builder", "Your own logo and favicon per store", "Search-friendly pages, sitemap and product feeds"],
  },
  {
    id: "catalog",
    icon: "Boxes",
    title: "Products & inventory",
    text: "Products with variants, photos, barcodes and categories. Stock is shared between the website and the shop counter and updated with every order.",
    points: ["Variants, options and SKUs", "Stock counts and low-stock alerts", "Stock goes back automatically when an order is cancelled"],
  },
  {
    id: "orders",
    icon: "ClipboardList",
    title: "Order management",
    text: "Follow every order from pending to confirmed, shipped, delivered, cancelled or returned – with one clear next step on each order.",
    points: ["Partial shipments with tracking numbers", "Returns, warranty claims and credit notes", "Printable invoices and packing slips"],
  },
  {
    id: "payments",
    icon: "CreditCard",
    title: "Flexible payment methods",
    text: "Cash on delivery, bank transfer and your own local methods (UPI, M-Pesa, PIX, Zelle …), plus Stripe card payments where Stripe is available.",
    points: ["Receipt and transaction id for transfers, approved by your team", "Cards confirmed by the provider, never by the browser", "Local wallets offered in the countries they belong to"],
  },
  {
    id: "shipping",
    icon: "Truck",
    title: "Shipping & fulfillment",
    text: "Delivery zones by city, area or postcode, free-delivery thresholds and delivery times – and delivery to other countries when you choose.",
    points: ["Zones per country", "Fee tester to check any address", "Courier and tracking details on every parcel"],
  },
  {
    id: "team",
    icon: "UsersRound",
    title: "Team & permissions",
    text: "Invite owners, managers and staff to each store with the right level of access. Owners and managers sign in with two-step verification.",
    points: ["Roles per store", "Email invitations that expire", "Activity log of important changes"],
  },
  {
    id: "pos",
    icon: "ScanBarcode",
    title: "Point of sale",
    text: "Sell in person at the shop counter with the same products and stock as your website – barcode lookup, split payments and printed receipts.",
    points: ["Shared online and in-store inventory", "Daily cash-up", "Same-day voids by a manager"],
  },
  {
    id: "reports",
    icon: "ChartNoAxesCombined",
    title: "Analytics & reports",
    text: "Sales, profit, payment methods, refused parcels and daily performance – in each store's own currency and time zone.",
    points: ["Sales and profit report with CSV export", "Dashboard for today and the last 30 days", "Returning customers and checkout completion"],
  },
  {
    id: "billing",
    icon: "BadgeCheck",
    title: "Subscription & billing",
    text: "Plans with product limits, team limits and features. Trials, renewals and grace periods are handled for every store from one place.",
    points: ["Free trial per plan", "Grace period when a payment fails", "Plan features checked by the server"],
  },
  {
    id: "notifications",
    icon: "BellRing",
    title: "Automated notifications",
    text: "Order emails, WhatsApp and SMS messages are queued and retried until they are delivered – using the providers you connect.",
    points: ["Order received, shipped and delivered messages", "Abandoned-cart reminders", "Signed webhooks to your own systems"],
  },
  {
    id: "security",
    icon: "ShieldCheck",
    title: "Secure multi-tenant architecture",
    text: "Every record belongs to one store, and the server checks the store and the person's role on every request.",
    points: ["Store-level data isolation", "Two-step verification for owners and managers", "Server-verified payments"],
  },
];

/** Not available yet – shown as planned, never as a feature. */
export const PLANNED = [
  "Prices in several currencies inside one store",
  "Translated storefront text",
  "More card payment providers (the plug-in system is ready)",
  "Stock in several warehouse locations",
  "Courier booking integrations",
];

export const STEPS = [
  { title: "Create your account", text: "Sign up with your email address and confirm it from the email we send." },
  { title: "Launch your store", text: "Choose a store name, web address, country and plan. The country sets your currency and time zone." },
  { title: "Configure your business", text: "Add products, delivery zones, payment methods, your branding and your team." },
  { title: "Publish and grow", text: "Open the store, take orders online and in person, and follow sales in your reports." },
];

export type Audience = { id: string; title: string; text: string; points: string[]; href?: string };

export const AUDIENCES: Audience[] = [
  {
    id: "entrepreneurs",
    title: "Independent entrepreneurs",
    text: "Start one store without building ecommerce from scratch, and add another when the next idea comes.",
    points: ["A store address from day one", "Payment methods your customers already use", "Simple order and stock management"],
  },
  {
    id: "multi-brand",
    title: "Multi-brand retailers",
    text: "Give each brand its own storefront, prices and team while you manage them from one account.",
    points: ["Separate catalogues and customers", "Per-store settings and domains", "Reports per brand"],
    href: "/solutions/multi-store",
  },
  {
    id: "retail",
    title: "Retailers with a physical shop",
    text: "Sell at the counter and online from the same stock, with receipts, cash-ups and returns in one place.",
    points: ["Point of sale with barcode lookup", "Shared inventory", "Returns and warranty claims"],
    href: "/solutions/retail",
  },
  {
    id: "agencies",
    title: "Agencies",
    text: "Set up and look after stores for your clients, each with its own owner, team and billing.",
    points: ["Clients own their store and invite you as a manager", "Switch between every store you work on", "Each client's data kept separate"],
    href: "/solutions/agencies",
  },
];

export const SECURITY_POINTS = [
  { title: "Store-level data isolation", text: "Every product, order, customer and setting belongs to one store. The server checks which store a request is for and refuses anything that belongs to another." },
  { title: "Role-based access", text: "Owners, managers and staff see and change only what their role in that store allows – the server checks again on every action." },
  { title: "Two-step verification", text: "Owners and managers sign in with a code from an authenticator app; their role only counts once two-step verification is on." },
  { title: "Server-verified payments", text: "An order is marked paid only when the payment provider confirms it with a signed message – never because a browser says so." },
  { title: "Consistent orders and stock", text: "An order, its stock and its discount use are saved together. Cancelling gives stock back exactly once." },
  { title: "Reliable notifications", text: "Messages and webhooks go through a queue and are retried with back-off, so a short outage doesn't lose them." },
];

export type Faq = { q: string; a: string; group: "Platform" | "Stores" | "Payments" | "Plans" };

export const FAQS: Faq[] = [
  { group: "Platform", q: "What is ShopEngine?", a: "ShopEngine is an ecommerce platform for running one or more independent online stores. Each store has its own web address, products, customers, orders, payments, team and settings, while ShopEngine provides the shared infrastructure, security and billing." },
  { group: "Platform", q: "Can I manage multiple online stores?", a: "Yes. One account can own up to three stores by default, and ShopEngine can raise the limit on request. You switch between stores in the admin; each store's data stays separate." },
  { group: "Stores", q: "Does each store have its own web address?", a: "Yes. Every store gets an address on the ShopEngine domain (for example yourstore.<platform domain>) as soon as it is created." },
  { group: "Stores", q: "Can I use my own domain?", a: "Yes, on plans that include custom domains. You point your domain to ShopEngine and add a DNS TXT record to prove it is yours; the store then answers on your domain." },
  { group: "Payments", q: "Which payment methods are supported?", a: "Cash on delivery, bank transfer and your own local methods (such as UPI, M-Pesa, PIX or Zelle) work in every country – shoppers pay you directly and upload the receipt. Card payments run through Stripe in the countries where Stripe onboards businesses, on plans that include online payments. JazzCash and EasyPaisa are available to stores in Pakistan." },
  { group: "Stores", q: "Can I manage in-person and online sales together?", a: "Yes, on plans with the shop counter. In-person sales use the same products and stock as your website, with barcode lookup, split payments, receipts and a daily cash-up." },
  { group: "Stores", q: "Can I invite employees to manage my store?", a: "Yes. Invite managers and staff by email; each person only gets the access their role allows in that store. The number of team members depends on your plan." },
  { group: "Plans", q: "How does ShopEngine pricing work?", a: "Each store is on a plan with a monthly or annual price, a product limit, a team limit and a set of features such as custom domains, card payments or the shop counter. Current plans are shown on the pricing page." },
  { group: "Plans", q: "What happens when my trial ends?", a: "If the plan isn't paid when the trial ends, the store gets a grace period (seven days by default). After that it goes offline and its admin becomes read-only until the plan is paid – nothing is deleted." },
  { group: "Stores", q: "Can my store accept international orders?", a: "Yes. Each store sells in its own currency, and you can add other countries you deliver to with their own delivery zones. Shoppers then choose their country at checkout, and phone and address checks follow it." },
];

export type Article = { slug: string; title: string; description: string; date: string; readMinutes: number; sections: { heading: string; paragraphs: string[] }[] };

export const ARTICLES: Article[] = [
  {
    slug: "run-multiple-online-stores-from-one-platform",
    title: "How to run multiple online stores from one platform",
    description: "When a second store makes sense, what to keep separate and what to share – a practical guide to managing several storefronts without doubling your work.",
    date: "2026-10-16",
    readMinutes: 6,
    sections: [
      {
        heading: "When a second store makes sense",
        paragraphs: [
          "A second store is worth it when the audience, brand or price level is different enough that one storefront would confuse shoppers – a premium line next to a budget line, a new country, or a separate brand you sell wholesale.",
          "If the products and customers are the same, a new collection or category in your existing store is usually the better choice.",
        ],
      },
      {
        heading: "Keep customers, prices and settings separate",
        paragraphs: [
          "Each store should have its own customers, orders, prices and settings, so a change in one never surprises the other. In ShopEngine every store is its own space: its own web address, catalogue, payment methods, delivery zones and team.",
          "That separation also keeps reporting honest – each store's sales and profit are shown in its own currency and time zone.",
        ],
      },
      {
        heading: "Share the work, not the data",
        paragraphs: [
          "What you do want to share is effort: one sign-in, one place to switch between stores, and the same order workflow everywhere. Your team can be invited to just the stores they work in, with the role they need.",
        ],
      },
      {
        heading: "A checklist for the new store",
        paragraphs: [
          "Pick the store's country (it sets the currency and time zone), add products, set delivery zones and payment methods, upload your logo, invite your team, then publish. Draft stores stay hidden from shoppers until you open them.",
        ],
      },
    ],
  },
  {
    slug: "choosing-payment-methods-for-your-country",
    title: "Choosing payment methods for your country",
    description: "Cash on delivery, bank transfers, local wallets and cards: how to decide what to offer, and how to keep payments safe when customers pay you directly.",
    date: "2026-10-16",
    readMinutes: 5,
    sections: [
      {
        heading: "Start with how your customers already pay",
        paragraphs: [
          "The best payment method is the one your customers trust. In many markets that is a local wallet or an instant bank transfer – UPI in India, M-Pesa in Kenya, PIX in Brazil – rather than a card.",
          "ShopEngine lets every store add its own methods with account details and instructions, and suggests the popular ones for the store's country.",
        ],
      },
      {
        heading: "Direct payments need a receipt",
        paragraphs: [
          "When a customer pays you directly, ask for the receipt and the transaction id at checkout, and approve the payment before the order ships. ShopEngine holds such orders until a manager marks them paid, and a transaction id can only be used once in a store.",
        ],
      },
      {
        heading: "Cash on delivery, with limits",
        paragraphs: [
          "Cash on delivery lowers the barrier for first-time buyers. Set a maximum order value, and ask for an advance on large or risky orders – both are settings, not code.",
        ],
      },
      {
        heading: "Cards, where available",
        paragraphs: [
          "Card payments through Stripe are confirmed by Stripe itself, never by the shopper's browser, and the money goes to the store's own Stripe account. Stripe works in many – not all – countries, so check availability for yours.",
        ],
      },
    ],
  },
  {
    slug: "selling-online-and-in-store-with-one-inventory",
    title: "Selling online and in store with one inventory",
    description: "Why a shared stock count matters when you sell at the counter and on the web, and how to keep orders, returns and cash-ups in step.",
    date: "2026-10-16",
    readMinutes: 5,
    sections: [
      {
        heading: "One stock count, two channels",
        paragraphs: [
          "Selling the last unit twice – once online, once at the counter – costs you a refund and a customer. A single inventory used by both channels prevents it: every sale takes stock immediately, wherever it happens.",
        ],
      },
      {
        heading: "Fast counter sales",
        paragraphs: [
          "At the counter, speed matters: look products up by barcode or name, apply a discount, split the payment between cash and card or a wallet, and print the receipt. ShopEngine's shop counter does this with the same products as the website.",
        ],
      },
      {
        heading: "Close the day properly",
        paragraphs: [
          "A daily cash-up compares the cash you counted with what the system expected. Mistakes are corrected with a void by a manager on the same day, which puts the stock back.",
        ],
      },
      {
        heading: "Returns from either channel",
        paragraphs: [
          "Returns and warranty claims follow the same rules whether the sale was online or in person, so customers get the same answer everywhere.",
        ],
      },
    ],
  },
];

/** The contact form's topics (the server action accepts only these). */
export const CONTACT_TOPICS = ["Sales and plans", "Getting started", "Support for my store", "Agencies and partnerships", "Security report", "Something else"] as const;

/** An article date (YYYY-MM-DD) as "16 October 2026". */
export const formatDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
