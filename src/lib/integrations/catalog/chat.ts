import type { IntegrationInfo } from "../catalog-types";

/** Live chat widgets on the storefront (one at a time). */
export const CHAT: IntegrationInfo[] = [
  {
    id: "tawk",
    name: "tawk.to",
    category: "chat",
    summary: "Free live chat on your store, answered from the tawk.to app.",
    steps: ["In tawk.to → Administration → Chat Widget, copy the “Direct Chat Link”: https://tawk.to/chat/<property id>/<widget id>.", "Paste the two ids here."],
    fields: [
      { key: "propertyId", label: "Property ID", type: "text", required: true, placeholder: "64f1a2b3c4d5e6f7a8b9c0d1" },
      { key: "widgetId", label: "Widget ID", type: "text", required: true, default: "default", placeholder: "default" },
    ],
    minRole: "store_manager",
    exclusive: "chat",
    verified: false,
    docsUrl: "https://help.tawk.to/article/adding-a-widget-to-your-website",
    color: "#03a84e",
  },
  {
    id: "crisp",
    name: "Crisp",
    category: "chat",
    summary: "Live chat and a shared inbox for your team.",
    steps: ["In Crisp → Settings → Website Settings → Setup instructions, copy the Website ID."],
    fields: [{ key: "websiteId", label: "Website ID", type: "text", required: true, placeholder: "00000000-0000-0000-0000-000000000000" }],
    minRole: "store_manager",
    exclusive: "chat",
    verified: false,
    docsUrl: "https://help.crisp.chat/en/article/how-do-i-install-crisp-live-chat-on-my-website-1hpd9eq/",
    color: "#1972f5",
  },
];
