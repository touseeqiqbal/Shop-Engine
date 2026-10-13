import type { GlobalConfig } from "payload";
import { anyone, managers, staff } from "../access";
import { dbName } from "../fields";
import { linkFields } from "../link";
import { revalidateChrome } from "../revalidate";

/*
 * “Online store” editor (like Shopify → Themes → Customize). Every default reproduces the current storefront,
 * so nothing changes until a value is edited. Saving refreshes the live site immediately (revalidateChrome).
 */

const hex = (value: unknown) => (!value || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value)) ? true : "Use a hex colour like #00C6FF");
const colorField = (name: string, label: string, defaultValue: string, description?: string) =>
  ({ name, label, type: "text" as const, defaultValue, validate: hex, admin: { width: "33%", description } });

const FONT_OPTIONS = [
  { label: "Inter", value: "inter" },
  { label: "Space Grotesk", value: "space-grotesk" },
  { label: "Montserrat", value: "montserrat" },
  { label: "Poppins", value: "poppins" },
];

// Version history (Versions tab → "Restore this version"): roll the storefront look back to an earlier save.
// Old versions are staff-only – the settings themselves are public (the storefront reads them).
const common = {
  access: { read: anyone, readVersions: staff, update: managers },
  versions: { max: 30 },
  hooks: { afterChange: [revalidateChrome] },
} satisfies Pick<GlobalConfig, "access" | "versions" | "hooks">;

export const ThemeSettings: GlobalConfig = {
  slug: "theme-settings",
  dbName: dbName("theme_settings"),
  label: "Theme settings",
  admin: { group: "Online store", description: "Logo, colours, fonts and button style for the whole storefront." },
  ...common,
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Logo & icons",
          fields: [
            { type: "row", fields: [
              { name: "logoDark", type: "upload", relationTo: "media", label: "Logo for dark mode", admin: { width: "50%", description: "Leave empty to use the built-in Urko logo." } },
              { name: "logoLight", type: "upload", relationTo: "media", label: "Logo for light mode", admin: { width: "50%" } },
            ] },
            { type: "row", fields: [
              { name: "favicon", type: "upload", relationTo: "media", admin: { width: "50%", description: "Square PNG/SVG, at least 512×512." } },
              { name: "logoHeight", type: "number", defaultValue: 36, min: 24, max: 80, admin: { width: "50%", description: "Header logo height in px." } },
            ] },
          ],
        },
        {
          label: "Colours",
          fields: [
            { type: "row", fields: [
              colorField("background", "Page background (dark mode)", "#0a0a0f"),
              colorField("backgroundLight", "Page background (light mode)", "#f5f6fa"),
              colorField("accent", "Accent", "#00d4ff", "Links, highlights, “Tech Store” wordmark."),
            ] },
            { type: "row", fields: [
              colorField("gradientFrom", "Brand gradient – start", "#00b4f0"),
              colorField("gradientVia", "Brand gradient – middle", "#3b82f6"),
              colorField("gradientTo", "Brand gradient – end", "#8b5cf6"),
            ] },
          ],
        },
        {
          label: "Typography & buttons",
          fields: [
            { type: "row", fields: [
              { name: "bodyFont", type: "select", defaultValue: "inter", options: FONT_OPTIONS, admin: { width: "50%" } },
              { name: "headingFont", type: "select", defaultValue: "space-grotesk", options: FONT_OPTIONS, admin: { width: "50%" } },
            ] },
            { type: "row", fields: [
              { name: "buttonStyle", type: "select", defaultValue: "pill", options: [
                { label: "Pill (fully rounded)", value: "pill" },
                { label: "Rounded", value: "rounded" },
                { label: "Square", value: "square" },
              ], admin: { width: "50%" } },
              { name: "cardRadius", type: "select", defaultValue: "xl", options: [
                { label: "Square (4px)", value: "sm" },
                { label: "Soft (12px)", value: "md" },
                { label: "Rounded (20px)", value: "xl" },
                { label: "Extra rounded (28px)", value: "2xl" },
              ], admin: { width: "50%" } },
            ] },
          ],
        },
        {
          label: "Colour mode",
          fields: [
            { name: "defaultMode", type: "select", defaultValue: "dark", options: [{ label: "Dark", value: "dark" }, { label: "Light", value: "light" }] },
            { name: "allowModeToggle", type: "checkbox", defaultValue: true, label: "Let shoppers switch between dark and light" },
          ],
        },
      ],
    },
  ],
};

export const AnnouncementBar: GlobalConfig = {
  slug: "announcement-bar",
  dbName: dbName("announcement_bar"),
  label: "Announcement bar",
  admin: { group: "Online store", description: "The thin message bar at the very top of every page." },
  ...common,
  access: { read: anyone, update: staff },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: true, label: "Show the announcement bar" },
    { name: "text", type: "text", defaultValue: "Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan", admin: { description: "Leave empty to show the store tagline." } },
    { type: "row", fields: [
      { name: "linkUrl", type: "text", admin: { width: "50%", description: "Optional, e.g. /deals" } },
      { name: "linkLabel", type: "text", admin: { width: "50%", description: "e.g. Shop now" } },
    ] },
    { type: "row", fields: [
      colorField("backgroundColor", "Background colour", "", "Empty = theme default"),
      colorField("textColor", "Text colour", "", "Empty = theme default"),
    ] },
    { type: "row", fields: [
      { name: "startsAt", type: "date", admin: { width: "50%", date: { pickerAppearance: "dayAndTime" }, description: "Optional – show from" } },
      { name: "endsAt", type: "date", admin: { width: "50%", date: { pickerAppearance: "dayAndTime" }, description: "Optional – hide after" } },
    ] },
    { name: "showContactLinks", type: "checkbox", defaultValue: true, label: "Show phone / WhatsApp / email links on the right" },
  ],
};

export const HeaderSettings: GlobalConfig = {
  slug: "header",
  dbName: dbName("header"),
  label: "Header",
  admin: { group: "Online store" },
  ...common,
  fields: [
    { name: "mainMenu", type: "relationship", relationTo: "menus", admin: { description: "Desktop navigation + mobile menu. Items marked “mega menu” open a large dropdown." } },
    { name: "mobileMenu", type: "relationship", relationTo: "menus", admin: { description: "Optional separate menu for phones (defaults to the main menu)." } },
    { type: "row", fields: [
      { name: "sticky", type: "checkbox", defaultValue: true, label: "Sticky header (stays on top while scrolling)", admin: { width: "50%" } },
      { name: "showSearch", type: "checkbox", defaultValue: true, label: "Show search", admin: { width: "50%" } },
    ] },
    { type: "row", fields: [
      { name: "showLanguageToggle", type: "checkbox", defaultValue: true, label: "Show English / اردو toggle", admin: { width: "50%" } },
      { name: "showAccountLinks", type: "checkbox", defaultValue: true, label: "Show compare / wishlist / account icons", admin: { width: "50%" } },
    ] },
  ],
};

export const FooterSettings: GlobalConfig = {
  slug: "footer",
  dbName: dbName("footer"),
  label: "Footer",
  admin: { group: "Online store" },
  ...common,
  fields: [
    { name: "about", type: "textarea", defaultValue: "Laptops & Tech Accessories – Delivered All Over Pakistan. New, used & refurbished laptops and computer accessories from Saddar, Karachi." },
    {
      name: "columns",
      type: "array",
      maxRows: 4,
      admin: { description: "Link columns. Pick a menu for each column (Online store → Menus).", components: { RowLabel: "/payload/admin/RowLabel#TitleRowLabel" } },
      fields: [
        { name: "title", type: "text", required: true },
        { name: "menu", type: "relationship", relationTo: "menus", required: true },
      ],
    },
    { type: "row", fields: [
      { name: "showContactInfo", type: "checkbox", defaultValue: true, label: "Address, phones, email & hours", admin: { width: "33%" } },
      { name: "showSocialLinks", type: "checkbox", defaultValue: true, label: "Social icons", admin: { width: "33%" } },
      { name: "showCityLinks", type: "checkbox", defaultValue: true, label: "“Laptops in {city}” links", admin: { width: "33%" } },
    ] },
    { name: "paymentBadges", type: "text", hasMany: true, defaultValue: ["Cash on Delivery", "JazzCash", "EasyPaisa", "Bank Transfer", "TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier"], admin: { description: "Payment methods / couriers shown as badges." } },
    { name: "copyright", type: "text", defaultValue: "© {year} {store}. All rights reserved.", admin: { description: "{year} and {store} are filled in automatically." } },
  ],
};

export const WhatsAppSettings: GlobalConfig = {
  slug: "whatsapp-button",
  dbName: dbName("whatsapp_button"),
  label: "WhatsApp button",
  admin: { group: "Online store", description: "The floating green WhatsApp button on every page." },
  ...common,
  access: { read: anyone, update: staff },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: true, label: "Show the floating WhatsApp button" },
    {
      name: "contacts",
      type: "array",
      label: "WhatsApp numbers",
      admin: { description: "Leave empty to use the phone numbers from Store info. One number = opens chat directly; several = shopper chooses." },
      fields: [{ type: "row", fields: [
        { name: "label", type: "text", required: true, admin: { width: "40%" } },
        { name: "phone", type: "text", required: true, admin: { width: "60%", description: "International format, e.g. +92 342 6693115" } },
      ] }],
    },
    { name: "message", type: "textarea", defaultValue: "Hi Urko Tech Store! I need help with an order.", label: "Pre-filled message" },
    { name: "note", type: "text", label: "Small text under the title", admin: { description: "Leave empty to use the note from Store info." } },
    { name: "position", type: "select", defaultValue: "right", options: [{ label: "Bottom right", value: "right" }, { label: "Bottom left", value: "left" }] },
  ],
};

// Link helper re-export (used by future blocks)
export { linkFields };
