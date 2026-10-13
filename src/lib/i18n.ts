/**
 * Lightweight UI-string dictionary for the optional English / Urdu toggle.
 * Product data & long-form content stay in English (best for SEO); navigation and key actions are translated.
 */
export type Lang = "en" | "ur";

export const dict = {
  home: { en: "Home", ur: "ہوم" },
  categories: { en: "Categories", ur: "کیٹیگریز" },
  search: { en: "Search", ur: "تلاش" },
  cart: { en: "Cart", ur: "کارٹ" },
  account: { en: "Account", ur: "اکاؤنٹ" },
  shop: { en: "Shop", ur: "شاپ" },
  deals: { en: "Hot Deals", ur: "ہاٹ ڈیلز" },
  findParts: { en: "Find Parts", ur: "پارٹس تلاش کریں" },
  compare: { en: "Compare", ur: "موازنہ" },
  wishlist: { en: "Wishlist", ur: "پسندیدہ" },
  blog: { en: "Blog", ur: "بلاگ" },
  contact: { en: "Contact", ur: "رابطہ" },
  trackOrder: { en: "Track Order", ur: "آرڈر ٹریک کریں" },
  addToCart: { en: "Add to Cart", ur: "کارٹ میں شامل کریں" },
  buyNow: { en: "Buy Now", ur: "ابھی خریدیں" },
  orderOnWhatsapp: { en: "Order on WhatsApp", ur: "واٹس ایپ پر آرڈر کریں" },
  checkout: { en: "Checkout", ur: "چیک آؤٹ" },
  searchPlaceholder: { en: "Search laptops, chargers, batteries…", ur: "لیپ ٹاپ، چارجر، بیٹری تلاش کریں…" },
  cod: { en: "Cash on Delivery", ur: "کیش آن ڈیلیوری" },
  deliveryAllPk: { en: "Delivery all over Pakistan", ur: "پورے پاکستان میں ڈیلیوری" },
  inStock: { en: "In stock", ur: "اسٹاک میں" },
  outOfStock: { en: "Out of stock", ur: "اسٹاک ختم" },
  viewAll: { en: "View all", ur: "سب دیکھیں" },
  chatWithUs: { en: "Chat with us", ur: "ہم سے بات کریں" },
  emptyCart: { en: "Your cart is empty", ur: "آپ کا کارٹ خالی ہے" },
  subtotal: { en: "Subtotal", ur: "سب ٹوٹل" },
  continueShopping: { en: "Continue shopping", ur: "خریداری جاری رکھیں" },
  viewCart: { en: "View cart", ur: "کارٹ دیکھیں" },
} as const;

export type DictKey = keyof typeof dict;
