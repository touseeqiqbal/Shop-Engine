/* Shared domain types. Mirrors prisma/schema.prisma (same field names). */

export type AttributeKind = "select" | "boolean" | "range";

export interface CategoryAttribute {
  key: string;
  label: string;
  kind: AttributeKind;
  /** Allowed values for `select`. Leave empty to auto-derive from products. */
  options?: string[];
  unit?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameUr?: string;
  parentId: string | null;
  /** lucide-react icon name, e.g. "Laptop" */
  icon: string;
  image?: string;
  shortDescription: string;
  /** Long SEO copy (Markdown) shown at the bottom of the category page */
  seoContent?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoNoindex?: boolean;
  seoCanonical?: string;
  /** Filterable attributes. Sub-categories inherit their parent's attributes. */
  attributes: CategoryAttribute[];
  /** Shows the "Find parts for your laptop" finder on this category */
  compatibility?: boolean;
  featured?: boolean;
  sortOrder: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export type Condition = "new" | "used-a-plus" | "used-a" | "refurbished" | "open-box";

export interface UpgradeOption {
  id: string;
  group: string; // e.g. "RAM", "SSD"
  label: string; // e.g. "Upgrade to 32GB"
  price: number; // extra PKR
}

export interface SpecRow {
  label: string;
  value: string;
}

export type AttrValue = string | number | boolean;

/** Bulk / wholesale details on a product (quote-only – wholesale prices are never published). */
export interface WholesaleInfo {
  /** Shows "Request bulk quote" on retail products */
  available: boolean;
  /** Minimum units for a wholesale quote (e.g. 5) */
  minQty?: number;
  /** Units in a lot / pallet listing (e.g. 25) */
  lotSize?: number;
  /** e.g. "Grade A / B" */
  grades?: string;
  /** What's in the lot, e.g. "15× HP EliteBook 840 G5, 10× Dell Latitude 7490" */
  contents?: string;
  note?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string; // brand slug
  categoryId: string; // leaf (sub)category id
  sku: string;
  shortDescription: string;
  description: string; // Markdown
  price: number; // regular price PKR
  salePrice?: number | null; // discounted price PKR
  stock: number;
  condition?: Condition;
  conditionNotes?: string; // e.g. "Battery health 88%, minor scratches on lid"
  warranty: string;
  images: string[];
  /** Alt text per image (same order as `images`); filled from uploaded ProductImage rows */
  imageAlts?: string[];
  video?: string; // YouTube embed / mp4 URL
  specs: SpecRow[];
  attributes: Record<string, AttrValue>;
  /** LaptopModel ids this part is compatible with */
  compatibility: string[];
  upgrades: UpgradeOption[];
  /** Product ids for "Frequently bought together" */
  boughtTogether: string[];
  bundleDiscountPercent?: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  tags: string[];
  featured?: boolean;
  hotDeal?: boolean;
  dealEndsAt?: string | null;
  bestSeller?: boolean;
  status: "active" | "draft";
  seoTitle?: string;
  seoDescription?: string;
  seoNoindex?: boolean;
  seoCanonical?: string;
  /** Lot / quote-only listing: price is never shown and it can't be added to cart */
  priceOnRequest?: boolean;
  wholesale?: WholesaleInfo | null;
  /** Selling unit, e.g. "piece", "pair", "box of 10" (empty = piece) */
  unit?: string;
  /** Set on a variant: the storefront id of its main product (a variant is only shown on that product's page) */
  variantOf?: string;
  /** A variant's option, e.g. { Colour: "Black", Size: "L" } */
  optionValues?: Record<string, string>;
  /** On a main product: its options, e.g. [{ name: "Colour", values: ["Black", "Silver"] }] */
  variantOptions?: { name: string; values: string[] }[];
  createdAt: string;
  /** last edit (sitemap "last modified") */
  updatedAt?: string;
}

export interface Brand {
  slug: string;
  name: string;
  logo?: string;
}

export interface LaptopModel {
  id: string; // e.g. "hp-elitebook-840-g5"
  brand: string; // brand slug
  series: string; // e.g. "EliteBook"
  name: string; // e.g. "EliteBook 840 G5"
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  city?: string;
  rating: number;
  title?: string;
  body: string;
  approved: boolean;
  verified?: boolean;
  createdAt: string;
  /** public image URLs (approved reviews only) */
  photos?: string[];
}

export interface Testimonial {
  name: string;
  city: string;
  rating: number;
  text: string;
  product?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // Markdown
  cover: string;
  category: string;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt?: string;
  relatedProducts: string[]; // product slugs
  relatedCategories: string[]; // category slugs
  seoTitle?: string;
  seoDescription?: string;
  seoNoindex?: boolean;
  seoCanonical?: string;
  status: "published" | "draft";
}

export interface Banner {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  accent?: string; // tailwind gradient classes
  placement: "hero" | "promo";
  sortOrder: number;
  active: boolean;
}

export type OrderStatus =
  | "awaiting-confirmation"
  | "pending"
  | "confirmed"
  | "dispatched"
  | "out-for-delivery"
  | "delivered"
  | "cancelled"
  | "refused"
  | "returned";

/** Customer confirmation of a cash-on-delivery order (fake-order protection). */
export interface OrderConfirmation {
  token: string;
  code: string;
  expiresAt: string;
  confirmedAt?: string | null;
  via?: string | null;
}

/** Risk of a phone number from its past orders. */
export interface OrderRisk {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string;
}

export type PaymentMethod = "cod" | "jazzcash" | "easypaisa" | "bank" | "card";
export type PaymentStatus = "unpaid" | "awaiting-verification" | "paid" | "refunded" | "partial";

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  url: string;
  unitPrice: number; // includes upgrades
  qty: number;
  upgrades: UpgradeOption[];
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  landmark?: string;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. UTS-260512-482193 (older orders: 4 digits)
  createdAt: string;
  status: OrderStatus;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string | null;
  deliveryCharge: number;
  total: number;
  advancePaid?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentScreenshotUrl?: string | null;
  courier?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  confirmation?: OrderConfirmation | null;
  risk?: OrderRisk | null;
  history: OrderEvent[];
  userId?: string | null;
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minOrder: number;
  expiresAt?: string | null;
  usageLimit?: number | null;
  used: number;
  active: boolean;
}

export interface FlashSale {
  id: string;
  title: string;
  endsAt: string;
  productIds: string[];
  active: boolean;
}

/** Shipping zone (/cms → Settings → Shipping). */
export interface ShippingZone {
  name: string;
  /** City names (as in PAKISTAN_CITIES); ignored when `rest` is true */
  cities: string[];
  /** Catch-all zone for every city not in another zone */
  rest?: boolean;
  charge: number;
  /** Free delivery above this cart total for this zone (null = store-wide threshold) */
  freeAbove?: number | null;
  /** e.g. "Same day / Next day" (empty = built-in estimate) */
  estimate?: string;
}

export interface PaymentMethodSettings {
  enabled: boolean;
  /** Extra text shown under the method at checkout */
  note?: string;
}

/** Payment options (/cms → Settings → Payments). Missing = original behaviour. */
export interface PaymentSettings {
  cod: PaymentMethodSettings & { fee: number; maxOrder: number | null };
  jazzcash: PaymentMethodSettings;
  easypaisa: PaymentMethodSettings;
  bank: PaymentMethodSettings;
}

export interface StoreSettings {
  /** Shipping zones; when present they replace cityCharges/defaultDeliveryCharge */
  zones?: ShippingZone[];
  payments?: PaymentSettings;
  freeDeliveryThreshold: number;
  defaultDeliveryCharge: number;
  /** Per-city delivery charge overrides, city name → PKR */
  cityCharges: Record<string, number>;
  /** Orders above this total ask for advance payment on COD */
  advanceThreshold: number;
  advanceAmount: number;
  bank: { bankName: string; accountTitle: string; accountNumber: string; iban: string };
  jazzcash: { title: string; number: string };
  easypaisa: { title: string; number: string };
  announcement?: string;
}

export interface Redirect {
  fromPath: string;
  toPath: string;
  permanent: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
  group?: string;
}

/** Product enriched with derived fields for rendering (URL, names). Returned by the catalog repo. */
export interface CatalogProduct extends Product {
  /** On a main product with options: its variants (each a full product with its own SKU, price and stock) */
  variants?: CatalogProduct[];
  /** How many variants it has (listings get only this – the full variants are for its own page and checkout) */
  variantCount?: number;
  url: string;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  topCategoryId: string;
  topCategorySlug: string;
  topCategoryName: string;
}

export type SortKey = "relevance" | "popular" | "newest" | "price-asc" | "price-desc" | "rating";

export interface ProductQuery {
  categorySlug?: string;
  brand?: string[];
  q?: string;
  condition?: Condition[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  /** category attribute filters, key → accepted values (booleans as "true") */
  attrs?: Record<string, string[]>;
  /** range attribute filters, key → [min, max] */
  ranges?: Record<string, [number, number]>;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

export interface Facet {
  key: string;
  label: string;
  kind: AttributeKind;
  unit?: string;
  options: { value: string; count: number }[];
  min?: number;
  max?: number;
}

export interface ProductQueryResult {
  items: CatalogProduct[];
  total: number;
  page: number;
  pages: number;
  facets: Facet[];
  brands: { value: string; label: string; count: number }[];
  conditions: { value: Condition; count: number }[];
  priceRange: [number, number];
  /** a corrected search when nothing matched ("macbok" → "macbook") */
  didYouMean?: string | null;
  /** no product matched every searched word – these are the closest matches */
  approximate?: boolean;
}

/** A saved delivery address on a customer account. */
export interface SavedAddress {
  id: string;
  label: string; // e.g. "Home", "Office"
  name: string;
  phone: string;
  city: string;
  address: string;
  landmark?: string;
  isDefault?: boolean;
}

// ───────────────────────────── wholesale ─────────────────────────────

export type WholesaleInquiryStatus = "new" | "contacted" | "quoted" | "won" | "lost";
export type WholesaleBuyerType = "shop" | "reseller" | "corporate" | "education" | "individual" | "other";

export interface WholesaleInquiryItem {
  productId?: string;
  productName: string;
  url?: string;
  qty: number;
}

export interface WholesaleInquiry {
  id: string;
  createdAt: string;
  status: WholesaleInquiryStatus;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  city: string;
  buyerType: WholesaleBuyerType;
  items: WholesaleInquiryItem[];
  message?: string;
  budget?: string;
  adminNotes?: string;
  /** Page path the inquiry was sent from */
  source?: string;
}
