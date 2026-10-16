import type { IntegrationInfo } from "../catalog-types";

/**
 * Marketplaces: the store's stock and prices stay in step with its marketplace listings (matched by SKU), and
 * marketplace orders take their items off the store's stock – so the same item is never sold twice.
 * ShopEngine's stock is the master: it is sent to the marketplace after the marketplace's own orders are counted.
 */

export const MARKETPLACES: IntegrationInfo[] = [
  {
    id: "daraz",
    name: "Daraz",
    category: "marketplaces",
    summary: "Keep Daraz prices and stock in step with your store, and take Daraz orders off your stock.",
    countries: ["PK", "BD", "LK", "NP", "MM"],
    oauth: true,
    steps: [
      "Click “Connect with Daraz” and sign in with your Daraz Seller Center account.",
      "Your Daraz products must have the same Seller SKU as your products here – only matching SKUs are updated.",
      "About every 30 minutes: new Daraz orders are taken off your stock (cancelled ones put back), then your prices and stock are sent to Daraz.",
    ],
    fields: [
      { key: "sendPrices", label: "Also send prices (otherwise stock only)", type: "checkbox" },
      { key: "warehouseCode", label: "Daraz warehouse code (optional)", type: "text", help: "Only if Daraz asks for one for your stock (multi-warehouse sellers)." },
    ],
    minRole: "store_owner",
    exclusive: "daraz",
    verified: false,
    docsUrl: "https://open.daraz.com/",
    color: "#f85606",
  },
  {
    id: "amazon",
    name: "Amazon",
    category: "marketplaces",
    summary: "Keep the stock of your own-shipped (merchant-fulfilled) Amazon listings in step, and take Amazon orders off your stock.",
    oauth: true,
    steps: [
      "Choose the Amazon marketplace you sell on, click “Connect with Amazon” and sign in to Seller Central.",
      "Your Amazon listings must use the same seller SKU as your products here – only matching SKUs are updated. Stock you keep at Amazon (FBA) is left alone.",
      "About every 30 minutes: new Amazon orders you ship yourself are taken off your stock (cancelled ones put back), then your stock is sent to Amazon.",
    ],
    fields: [
      {
        key: "marketplace",
        label: "Amazon marketplace",
        type: "select",
        beforeConnect: true,
        default: "US",
        options: [
          { label: "United States (amazon.com)", value: "US" },
          { label: "Canada", value: "CA" },
          { label: "Mexico", value: "MX" },
          { label: "Brazil", value: "BR" },
          { label: "United Kingdom", value: "UK" },
          { label: "Germany", value: "DE" },
          { label: "France", value: "FR" },
          { label: "Italy", value: "IT" },
          { label: "Spain", value: "ES" },
          { label: "Netherlands", value: "NL" },
          { label: "Sweden", value: "SE" },
          { label: "Poland", value: "PL" },
          { label: "Türkiye", value: "TR" },
          { label: "United Arab Emirates", value: "AE" },
          { label: "Saudi Arabia", value: "SA" },
          { label: "Egypt", value: "EG" },
          { label: "India", value: "IN" },
          { label: "Japan", value: "JP" },
          { label: "Australia", value: "AU" },
          { label: "Singapore", value: "SG" },
        ],
      },
      { key: "sendPrices", label: "Also send prices (when your store’s currency is the marketplace’s)", type: "checkbox" },
    ],
    minRole: "store_owner",
    exclusive: "amazon",
    verified: false,
    docsUrl: "https://developer-docs.amazon.com/sp-api/",
    color: "#ff9900",
  },
];
