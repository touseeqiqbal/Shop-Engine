import type { GlobalConfig } from "payload";
import { anyone, managers } from "../access";
import { dbName } from "../fields";
import { revalidate } from "../revalidate";

/** Cookie / analytics notice shown at the bottom of the website until the visitor chooses. */
export const CookieNotice: GlobalConfig = {
  slug: "cookie-notice",
  dbName: dbName("cookie-notice"),
  label: "Cookie notice",
  admin: { group: "Settings", description: "Google Analytics and the Meta Pixel only set cookies after the visitor presses Accept." },
  access: { read: anyone, update: managers },
  hooks: { afterChange: [({ doc }) => (revalidate(["settings"], ["/"]), doc)] },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: true, label: "Ask visitors before using analytics cookies" },
    {
      name: "message",
      type: "textarea",
      defaultValue: "We use cookies to keep your cart and sign-in working. With your OK we also measure visits (Google Analytics) and ads (Meta) to improve the shop.",
    },
    { type: "row", fields: [
      { name: "acceptLabel", type: "text", defaultValue: "Accept", label: "Accept button", admin: { width: "33%" } },
      { name: "rejectLabel", type: "text", defaultValue: "Only necessary", label: "Decline button", admin: { width: "33%" } },
      { name: "policyLink", type: "text", defaultValue: "/privacy-policy", label: "“Learn more” link", admin: { width: "34%" } },
    ] },
  ],
};
