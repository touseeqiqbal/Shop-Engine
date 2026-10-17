import type { ManualMethodSettings, PaymentDue } from "./payments/methods";
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
  /** keeps taking orders when sold out: "backorder" (ships when back in stock) or "preorder" (not released yet) */
  backorders?: "backorder" | "preorder";
  /** taxed at the store's reduced rate, or not at all (default: the normal rate) */
  taxClass?: "reduced" | "exempt";
  /** in a running flash sale with a discount: when that price ends (ISO) */
  flashEndsAt?: string | null;
  /** pre-orders: the day it ships from (ISO) */
  releaseDate?: string | null;
  /** e.g. "Ships in 2–3 weeks" */
  backorderNote?: string | null;
  /** kg (Products → weight) – for weight-based delivery prices and courier bookings */
  weightKg?: number;
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
  | "awaiting-payment"
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

/** The payment methods the platform knows (lib/payments/methods.ts). */
export type BuiltInPaymentMethod = "cod" | "jazzcash" | "easypaisa" | "bank" | "card";
/** A built-in method or a store's own one ("upi", "m-pesa" …) – see lib/payments/methods.ts. */
export type PaymentMethod = BuiltInPaymentMethod | (string & {});
export type PaymentStatus = "unpaid" | "awaiting-verification" | "paid" | "refunded" | "partial" | "partially-refunded";

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  url: string;
  unitPrice: number; // includes upgrades
  qty: number;
  upgrades: UpgradeOption[];
  /** ships later: sold before the product's release, or beyond its stock (`owedQty` of `qty`) */
  availability?: "preorder" | "backorder";
  owedQty?: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  landmark?: string;
  /** state / province / county (stores outside Pakistan) */
  region?: string;
  postalCode?: string;
  /** ISO code; the store's country unless the store ships abroad */
  country?: string;
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
  /** the delivery method chosen at checkout ("Express" …) – only for stores that offer a choice */
  shippingMethod?: string | null;
  /** a gift card that paid (part of) the order, and how much */
  giftCardCode?: string | null;
  giftCardAmount?: number;
  total: number;
  advancePaid?: number;
  paymentMethod: PaymentMethod;
  /** the method's name when the order was placed ("Bank Transfer", "UPI") */
  paymentMethodLabel?: string | null;
  /** paid before shipping, or when delivered (cash on delivery and the like) */
  paymentDue?: PaymentDue | null;
  /** ISO currency of every amount on the order (the store's when it was placed) */
  currency?: string;
  paymentStatus: PaymentStatus;
  paymentScreenshotUrl?: string | null;
  courier?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  /** the customer ticked "email me news and offers" (for this store only) */
  marketingConsent?: boolean;
  confirmation?: OrderConfirmation | null;
  risk?: OrderRisk | null;
  history: OrderEvent[];
  userId?: string | null;
  /** the store the order was placed in (multi-store) */
  storeId?: number | null;
  /** transfer / wallet transaction id, or the online payment's id – one order per payment */
  paymentReference?: string | null;
  /** tax included in the total (the store's tax rate) */
  taxTotal?: number;
  /** tax per rate, when the order had more than one rate (Products → Tax) */
  taxBreakdown?: TaxBreakdownLine[];
  /** invoice made out to someone else (a company …) */
  billing?: BillingAddress | null;
}

export interface Coupon {
  id?: string;
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number;
  minOrder: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  /** uses per customer (email / phone); null = unlimited */
  perCustomerLimit?: number | null;
  used: number;
  active: boolean;
  /** applied by itself to every qualifying cart (no code) */
  automatic?: boolean;
  /** adds up with the other kind (code + automatic) when both allow it */
  combinable?: boolean;
  appliesTo?: "all" | "products" | "categories" | "collections";
  productIds?: string[];
  categoryIds?: string[];
  collectionIds?: string[];
}

export interface FlashSale {
  id: string;
  title: string;
  endsAt: string;
  productIds: string[];
  active: boolean;
  /** % off its products while it runs (empty = a countdown only) */
  discountPercent?: number | null;
}

/** Shipping zone (/cms → Settings → Shipping). */
export interface ShippingZone {
  name: string;
  /** City names (as in PAKISTAN_CITIES); ignored when `rest` is true */
  cities: string[];
  /** Any country: cities, areas or postcode starts typed by the store (matched without case; "SW1*" = postcodes starting SW1) */
  places?: string[];
  /** ISO codes of the countries this zone covers; empty = the store's own country */
  countries?: string[];
  /** Catch-all zone for every city not in another zone */
  rest?: boolean;
  charge: number;
  /** Free delivery above this cart total for this zone (null = store-wide threshold) */
  freeAbove?: number | null;
  /** e.g. "Same day / Next day" (empty = built-in estimate) */
  estimate?: string;
  /** weight pricing of the zone's own (standard) rate: + this much per kg above `includedKg` */
  perKg?: number | null;
  includedKg?: number | null;
  /** other ways to deliver in this zone, offered next to the standard one (e.g. Express) */
  methods?: ShippingMethodRate[];
}

/** A delivery method of a zone besides its standard rate (Settings → Delivery → zone → Other delivery methods). */
export interface ShippingMethodRate {
  name: string;
  charge: number;
  /** + this much per kg above the zone's included weight (empty = no weight pricing) */
  perKg?: number | null;
  /** free above this cart total (empty = never free) */
  freeAbove?: number | null;
  estimate?: string;
}

/** A delivery choice for one address and cart, as checkout offers it. `id` "standard" = the zone's own rate. */
export interface ShippingOption {
  id: string;
  name: string;
  charge: number;
  estimate: string;
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
  /** online card payments – offered only once the store's payment account is connected (cardReady) */
  card?: PaymentMethodSettings;
}

export interface TaxSettings {
  enabled: boolean;
  /** percent */
  rate: number;
  /** prices already include tax (else it is added on top) */
  inclusive: boolean;
  label: string;
  taxDelivery: boolean;
  /** percent for products set to "Reduced rate" (Products → Tax); empty = the normal rate */
  reducedRate?: number;
}

/** How a product is taxed: the store's rate (default), its reduced rate, or no tax. */
export type TaxClass = "standard" | "reduced" | "exempt";

/** An order's tax per rate (invoices show one line per rate). */
export type TaxBreakdownLine = { rate: number; base: number; tax: number };

/** Who the invoice is made out to, when that isn't the person receiving the parcel. */
export interface BillingAddress {
  name: string;
  company?: string;
  /** VAT / NTN / tax number for a business invoice */
  taxId?: string;
  address: string;
  city: string;
  postalCode?: string;
  country?: string;
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
  tax?: TaxSettings;
  /** the store's online payment account is connected and can take cards */
  cardReady?: boolean;
  /** the provider that takes the store's card payments (lib/payments/catalog.ts), e.g. "stripe" */
  cardGateway?: string | null;
  /** online payment providers connected with the store's own account (Integrations → Online payments), in order */
  onlineGateways?: { id: string; label: string; needsEmail: boolean; icon: "card" | "wallet" }[];
  /** the store's own payment methods (any country's wallets, banks, "card on delivery" …) */
  manualMethods?: ManualMethodSettings[];
  /** ISO currency of the store's prices */
  currency?: string;
  /** ISO country of the store (address form, phone numbers, which payment methods exist) */
  country?: string;
  /** other countries the store delivers to (ISO codes; empty = only its own) */
  shipTo?: string[];
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
  region?: string;
  postalCode?: string;
  /** ISO code, when the store delivers abroad */
  country?: string;
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
