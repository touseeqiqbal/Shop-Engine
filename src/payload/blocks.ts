import type { Block, Field } from "payload";
import { sameStore } from "./tenancy";

/** Block table names: cms_pb_<name> (page builder) – keeps them clearly apart from every other table. */
const pb = (name: string) => `cms_pb_${name}`;
import { DEFAULT_TRUST_BADGES, SECTION_DEFAULTS, type HomeSectionType } from "../lib/content/home";

/*
 * Page builder blocks (like Shopify sections). Each block maps to a section component on the storefront
 * (src/components/blocks/render-blocks.tsx). Text defaults match today's home page; an empty field falls back
 * to the same default, so clearing a field never leaves a hole.
 */

type TextKey = "eyebrow" | "title" | "description" | "linkLabel" | "linkHref";

/** Section heading fields, pre-filled with the defaults of a legacy home section. */
const textFields = (type: HomeSectionType | null, keys: TextKey[] = ["eyebrow", "title", "description", "linkLabel", "linkHref"]): Field[] => {
  const d = (type ? SECTION_DEFAULTS[type] : {}) as Partial<Record<TextKey, string>>;
  const f = (name: TextKey, label: string, width: string, textarea = false): Field =>
    // an empty default is kept as "" (not left out) so the database's older default is never used instead
    ({ name, label, type: textarea ? "textarea" : "text", defaultValue: d[name], admin: { width } }) as Field;
  const top: Field[] = [];
  const bottom: Field[] = [];
  if (keys.includes("eyebrow")) top.push(f("eyebrow", "Small heading", "35%"));
  if (keys.includes("title")) top.push(f("title", "Heading", "65%"));
  if (keys.includes("linkLabel")) bottom.push(f("linkLabel", "Link text", "35%"));
  if (keys.includes("linkHref")) bottom.push(f("linkHref", "Link URL", "65%"));
  return [
    ...(top.length ? [{ type: "row", fields: top } as Field] : []),
    ...(keys.includes("description") ? [f("description", "Description", "100%", true)] : []),
    ...(bottom.length ? [{ type: "row", fields: bottom } as Field] : []),
  ];
};

const productLimit: Field = { name: "limit", type: "number", min: 1, max: 48, admin: { description: "How many products (empty = default)." } };

const BUTTON_FIELDS: Field[] = [
  { type: "row", fields: [
    { name: "buttonLabel", type: "text", admin: { width: "40%" } },
    { name: "buttonHref", type: "text", label: "Button link", admin: { width: "60%", description: "e.g. /deals or https://wa.me/92…" } },
  ] },
];

export const HeroBlock: Block = {
  slug: "hero",
  dbName: pb("hero"),
  labels: { singular: "Hero slider", plural: "Hero sliders" },
  admin: { group: "Store" },
  fields: [
    {
      name: "slides",
      type: "array",
      admin: { description: "Leave empty to use the hero banners (old admin → Marketing → Banners). The page heading (H1) is shown above the slider." },
      fields: [
        { name: "image", type: "upload", relationTo: "media", filterOptions: sameStore, admin: { description: "Upload an image, or use a built-in one below." } },
        { type: "row", fields: [
          { name: "imageUrl", type: "text", label: "…or built-in image path", admin: { width: "60%", description: "e.g. /images/hero/hero-gaming-laptops.svg" } },
          { name: "accent", type: "select", label: "Glow colour", defaultValue: "from-blue-500 to-violet-500", admin: { width: "40%" }, options: [
            { label: "Blue → violet", value: "from-blue-500 to-violet-500" },
            { label: "Violet → pink", value: "from-violet-500 to-fuchsia-500" },
            { label: "Cyan → blue", value: "from-cyan-500 to-blue-500" },
          ] },
        ] },
        { type: "row", fields: [
          { name: "eyebrow", type: "text", label: "Small heading", admin: { width: "35%" } },
          { name: "title", type: "text", required: true, admin: { width: "65%" } },
        ] },
        { name: "subtitle", type: "textarea" },
        { type: "row", fields: [
          { name: "ctaLabel", type: "text", label: "Button text", defaultValue: "Shop now", admin: { width: "40%" } },
          { name: "ctaHref", type: "text", label: "Button link", defaultValue: "/shop", admin: { width: "60%" } },
        ] },
      ],
    },
  ],
};

export const TrustBlock: Block = {
  slug: "trust",
  dbName: pb("trust"),
  labels: { singular: "Trust badges", plural: "Trust badges" },
  admin: { group: "Store" },
  fields: [
    {
      name: "badges",
      type: "array",
      minRows: 1,
      maxRows: 6,
      defaultValue: DEFAULT_TRUST_BADGES,
      fields: [{ type: "row", fields: [
        { name: "title", type: "text", required: true, admin: { width: "45%" } },
        { name: "text", type: "text", admin: { width: "55%" } },
      ] }],
    },
  ],
};

export const CategoriesBlock: Block = {
  slug: "categories",
  dbName: pb("cats"),
  labels: { singular: "Category grid", plural: "Category grids" },
  admin: { group: "Store" },
  fields: [
    ...textFields("categories"),
    { name: "categories", type: "relationship", relationTo: "categories", hasMany: true, filterOptions: sameStore, admin: { description: "Pick and order categories. Empty = all top-level categories." } },
  ],
};

export const DealsBlock: Block = {
  slug: "deals",
  dbName: pb("deals"),
  labels: { singular: "Hot deals", plural: "Hot deals" },
  admin: { group: "Products" },
  fields: [
    ...textFields("deals", ["eyebrow", "title", "linkLabel", "linkHref"]),
    { name: "source", type: "select", defaultValue: "auto", options: [
      { label: "Automatic – running flash sale, otherwise products marked “Hot deal”", value: "auto" },
      { label: "Pick products", value: "manual" },
    ] },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore, admin: { condition: (_, s) => s?.source === "manual" } },
    productLimit,
  ],
};

export const ProductsBlock: Block = {
  slug: "products",
  dbName: pb("prods"),
  labels: { singular: "Product carousel", plural: "Product carousels" },
  admin: { group: "Products" },
  fields: [
    { name: "note", type: "ui", admin: { components: { Field: { path: "/payload/admin/BlockNote#BlockNote", clientProps: { text: "Leave the texts empty to use automatic ones for the chosen products (e.g. “New arrivals”, or the category name with a “View all” link)." } } } } },
    ...textFields(null, ["eyebrow", "title", "linkLabel", "linkHref"]),
    { name: "source", type: "select", defaultValue: "newArrivals", options: [
      { label: "New arrivals (newest first)", value: "newArrivals" },
      { label: "Best sellers", value: "bestSellers" },
      { label: "Top accessories (most-sold non-laptops)", value: "topAccessories" },
      { label: "From a category", value: "category" },
      { label: "From a collection", value: "collection" },
      { label: "Pick products", value: "manual" },
    ] },
    { name: "category", type: "relationship", relationTo: "categories", filterOptions: sameStore, admin: { condition: (_, s) => s?.source === "category" } },
    { name: "collection", type: "relationship", relationTo: "product-collections", filterOptions: sameStore, admin: { condition: (_, s) => s?.source === "collection" } },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true, filterOptions: sameStore, admin: { condition: (_, s) => s?.source === "manual" } },
    productLimit,
  ],
};

const simple = (slug: string, type: HomeSectionType, singular: string, keys: TextKey[], description: string): Block => ({
  slug,
  dbName: pb(slug.slice(0, 12)),
  labels: { singular, plural: singular },
  admin: { group: "Store" },
  fields: [{ name: "note", type: "ui", admin: { components: { Field: { path: "/payload/admin/BlockNote#BlockNote", clientProps: { text: description } } } } }, ...textFields(type, keys)],
});

export const FinderBlock = simple("finder", "finder", "Parts finder", ["title", "description"], "“Find parts for your laptop” – brand & model picker.");
export const BrandsBlock = simple("brands", "brands", "Brand strip", ["eyebrow", "title", "linkLabel", "linkHref"], "Scrolling strip of all brands.");
export const InstallmentBlock = simple("installment", "installment", "Installment banner", ["eyebrow", "title", "description", "linkLabel", "linkHref"], "Promo banner for installment plans.");
export const TestimonialsBlock = simple("testimonials", "testimonials", "Testimonials", ["eyebrow", "title"], "Customer reviews (old admin → Store → Testimonials).");
export const SocialBlock = simple("social", "social", "Instagram & TikTok", ["eyebrow", "title", "description"], "Links to your social profiles (Store info).");
export const LocationBlock = simple("location", "location", "Store location & map", ["eyebrow", "title", "description"], "Address, opening hours and Google Map (Store info). **bold** works in the description.");

export const RichTextBlock: Block = {
  slug: "richText",
  dbName: pb("text"),
  labels: { singular: "Rich text", plural: "Rich text" },
  admin: { group: "Content" },
  fields: [
    { name: "content", type: "richText" },
    { name: "markdown", type: "textarea", admin: { description: "Markdown (used when the rich text above is empty – e.g. text imported from the old admin)." } },
    { type: "row", fields: [
      { name: "boxed", type: "checkbox", defaultValue: true, label: "Show inside a card", admin: { width: "50%" } },
      { name: "width", type: "select", defaultValue: "wide", options: [{ label: "Wide", value: "wide" }, { label: "Narrow (easier to read)", value: "narrow" }], admin: { width: "50%" } },
    ] },
  ],
};

export const ImageBannerBlock: Block = {
  slug: "imageBanner",
  dbName: pb("banner"),
  labels: { singular: "Image banner", plural: "Image banners" },
  admin: { group: "Content" },
  fields: [
    { name: "image", type: "upload", relationTo: "media", filterOptions: sameStore, required: true },
    { type: "row", fields: [
      { name: "eyebrow", type: "text", label: "Small heading", admin: { width: "35%" } },
      { name: "heading", type: "text", admin: { width: "65%" } },
    ] },
    { name: "text", type: "textarea" },
    ...BUTTON_FIELDS,
    { type: "row", fields: [
      { name: "align", type: "select", defaultValue: "left", options: [{ label: "Left", value: "left" }, { label: "Centre", value: "center" }], admin: { width: "50%" } },
      { name: "height", type: "select", defaultValue: "md", options: [{ label: "Small", value: "sm" }, { label: "Medium", value: "md" }, { label: "Large", value: "lg" }], admin: { width: "50%" } },
    ] },
  ],
};

export const ImageTextBlock: Block = {
  slug: "imageText",
  dbName: pb("imgtext"),
  labels: { singular: "Image with text", plural: "Image with text" },
  admin: { group: "Content" },
  fields: [
    { name: "image", type: "upload", relationTo: "media", filterOptions: sameStore, required: true },
    { type: "row", fields: [
      { name: "eyebrow", type: "text", label: "Small heading", admin: { width: "35%" } },
      { name: "heading", type: "text", admin: { width: "65%" } },
    ] },
    { name: "content", type: "richText" },
    ...BUTTON_FIELDS,
    { name: "imageSide", type: "select", defaultValue: "left", options: [{ label: "Image on the left", value: "left" }, { label: "Image on the right", value: "right" }] },
  ],
};

export const FaqBlock: Block = {
  slug: "faq",
  dbName: pb("faq"),
  labels: { singular: "FAQ", plural: "FAQs" },
  admin: { group: "Content" },
  fields: [
    ...textFields(null, ["eyebrow", "title"]),
    {
      name: "items",
      type: "array",
      minRows: 1,
      admin: { description: "Also added to the page as FAQ structured data (rich results in Google)." },
      fields: [
        { name: "question", type: "text", required: true },
        { name: "answer", type: "textarea", required: true },
      ],
    },
  ],
};

export const CtaBlock: Block = {
  slug: "cta",
  dbName: pb("cta"),
  labels: { singular: "Call to action", plural: "Calls to action" },
  admin: { group: "Content" },
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "text", type: "textarea" },
    {
      name: "buttons",
      type: "array",
      maxRows: 3,
      fields: [{ type: "row", fields: [
        { name: "label", type: "text", required: true, admin: { width: "35%" } },
        { name: "href", type: "text", required: true, label: "Link", admin: { width: "40%" } },
        { name: "style", type: "select", defaultValue: "primary", options: [
          { label: "Primary", value: "primary" },
          { label: "Secondary", value: "secondary" },
          { label: "WhatsApp (green)", value: "whatsapp" },
        ], admin: { width: "25%" } },
      ] }],
    },
  ],
};

export const PAGE_BLOCKS: Block[] = [
  HeroBlock,
  TrustBlock,
  CategoriesBlock,
  DealsBlock,
  ProductsBlock,
  FinderBlock,
  BrandsBlock,
  InstallmentBlock,
  TestimonialsBlock,
  SocialBlock,
  LocationBlock,
  RichTextBlock,
  ImageBannerBlock,
  ImageTextBlock,
  FaqBlock,
  CtaBlock,
];
