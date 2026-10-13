import type { Banner, Coupon, FaqItem, FlashSale, Redirect, Review, StoreSettings, Testimonial } from "@/lib/types";
import { SEED_DEAL_END } from "./products";

export const seedReviews: Review[] = [
  { id: "r1", productId: "p-hp-elitebook-840-g8", name: "Ahmed Raza", city: "Karachi", rating: 5, title: "Exactly as described", body: "Laptop was in A+ condition like they said, battery health 91%. Picked it up from the Regal shop and they even installed Office for me.", approved: true, verified: true, createdAt: "2026-08-12T10:00:00Z" },
  { id: "r2", productId: "p-hp-elitebook-840-g8", name: "Sana Malik", city: "Lahore", rating: 5, title: "Delivered in 2 days", body: "Ordered on WhatsApp, got it in Lahore within 2 days via TCS with COD. Very well packed.", approved: true, verified: true, createdAt: "2026-08-20T10:00:00Z" },
  { id: "r3", productId: "p-hp-elitebook-840-g8", name: "Bilal Khan", city: "Islamabad", rating: 4, body: "Good machine, fast SSD. Charger is original. Took one star because of slight delay in dispatch.", approved: true, verified: true, createdAt: "2026-08-28T10:00:00Z" },
  { id: "r4", productId: "p-dell-latitude-5420", name: "Usman Tariq", city: "Rawalpindi", rating: 5, body: "Core i7 is super fast for my development work. Highly recommend Urko.", approved: true, verified: true, createdAt: "2026-08-15T10:00:00Z" },
  { id: "r5", productId: "p-dell-latitude-5420", name: "Hira Shah", city: "Karachi", rating: 4, body: "Minor marks on lid as mentioned. Otherwise excellent.", approved: true, verified: true, createdAt: "2026-08-25T10:00:00Z" },
  { id: "r6", productId: "p-lenovo-thinkpad-t14", name: "Faisal Iqbal", city: "Faisalabad", rating: 5, body: "Refurbished but feels brand new. New battery lasts 7 hours.", approved: true, verified: true, createdAt: "2026-08-18T10:00:00Z" },
  { id: "r7", productId: "p-lenovo-thinkpad-t14", name: "Zainab Ali", city: "Multan", rating: 4, body: "Great keyboard. Delivery took 3 days to Multan.", approved: true, createdAt: "2026-09-01T10:00:00Z" },
  { id: "r8", productId: "p-macbook-air-m2", name: "Omer Siddiqui", city: "Karachi", rating: 5, body: "Box packed, genuine. Best price I found in Karachi.", approved: true, verified: true, createdAt: "2026-08-30T10:00:00Z" },
  { id: "r9", productId: "p-macbook-air-m2", name: "Ayesha Noor", city: "Islamabad", rating: 5, body: "Smooth experience and fast delivery.", approved: true, verified: true, createdAt: "2026-09-02T10:00:00Z" },
  { id: "r10", productId: "p-asus-tuf-f15", name: "Hamza Qureshi", city: "Peshawar", rating: 5, body: "Runs Valorant at 200+ FPS. Packed very well.", approved: true, verified: true, createdAt: "2026-09-03T10:00:00Z" },
  { id: "r11", productId: "p-logitech-m185", name: "Kashif Mehmood", city: "Hyderabad", rating: 5, body: "Original Logitech, works perfectly.", approved: true, verified: true, createdAt: "2026-08-10T10:00:00Z" },
  { id: "r12", productId: "p-logitech-m185", name: "Maria Khan", city: "Quetta", rating: 4, body: "Good mouse, got it in 4 days.", approved: true, createdAt: "2026-08-22T10:00:00Z" },
  { id: "r13", productId: "p-redragon-k552", name: "Ali Hassan", city: "Sialkot", rating: 5, body: "Blue switches are so satisfying. Great build quality.", approved: true, verified: true, createdAt: "2026-08-19T10:00:00Z" },
  { id: "r14", productId: "p-redragon-k552", name: "Saad Ahmed", city: "Karachi", rating: 5, body: "Best budget mechanical keyboard.", approved: true, createdAt: "2026-09-04T10:00:00Z" },
  { id: "r15", productId: "p-dell-65w-type-c", name: "Imran Javed", city: "Lahore", rating: 5, body: "Charges my Latitude 7420 at full speed. Good quality.", approved: true, verified: true, createdAt: "2026-08-14T10:00:00Z" },
  { id: "r16", productId: "p-hp-840-g5-battery", name: "Nadia Pervez", city: "Karachi", rating: 5, body: "They installed it for free at the shop. Now getting 6 hours again.", approved: true, verified: true, createdAt: "2026-08-26T10:00:00Z" },
  { id: "r17", productId: "p-kingston-nv2-512", name: "Waqas Ahmed", city: "Gujranwala", rating: 5, body: "Laptop boots in 8 seconds now!", approved: true, verified: true, createdAt: "2026-08-29T10:00:00Z" },
  { id: "r18", productId: "p-usb-c-hub-7in1", name: "Rabia Saleem", city: "Islamabad", rating: 5, body: "Works perfectly with my MacBook Air, 4K HDMI is great.", approved: true, verified: true, createdAt: "2026-09-05T10:00:00Z" },
];

export const seedTestimonials: Testimonial[] = [
  { name: "Ahmed Raza", city: "Karachi", rating: 5, text: "Bought a used EliteBook – it was exactly A+ like they promised. Honest shop in Regal, highly recommended.", product: "HP EliteBook 840 G8" },
  { name: "Sana Malik", city: "Lahore", rating: 5, text: "Ordered on WhatsApp at night and the laptop reached Lahore in 2 days with Cash on Delivery. Very professional.", product: "Dell Latitude 5420" },
  { name: "Hamza Qureshi", city: "Peshawar", rating: 5, text: "Got my TUF gaming laptop box packed with warranty. Best price compared to other shops.", product: "Asus TUF Gaming F15" },
  { name: "Nadia Pervez", city: "Karachi", rating: 5, text: "They found the right battery for my old HP and installed it for free. Great service!", product: "HP 840 G5 Battery" },
  { name: "Faisal Iqbal", city: "Faisalabad", rating: 5, text: "Refurbished ThinkPad feels brand new. 6 months warranty gave me peace of mind.", product: "Lenovo ThinkPad T14" },
  { name: "Rabia Saleem", city: "Islamabad", rating: 4, text: "Quick replies on WhatsApp and the USB-C hub works perfectly with my MacBook.", product: "7-in-1 USB-C Hub" },
];

export const seedBanners: Banner[] = [
  {
    id: "b1",
    eyebrow: "Used A+ · Checked & Tested",
    title: "Business laptops that feel brand new",
    subtitle: "HP EliteBook, Dell Latitude & Lenovo ThinkPad from Rs 87,500 with warranty and Cash on Delivery.",
    ctaLabel: "Shop used laptops",
    ctaHref: "/category/used-refurbished-laptops",
    image: "/images/hero/hero-business-laptops.svg",
    accent: "from-blue-500 to-violet-500",
    placement: "hero",
    sortOrder: 0,
    active: true,
  },
  {
    id: "b2",
    eyebrow: "RTX 40-Series · 144Hz",
    title: "Level up with gaming laptops",
    subtitle: "Asus TUF, MSI & more – brand new with official warranty. Free cooling pad on selected models.",
    ctaLabel: "Explore gaming",
    ctaHref: "/category/gaming-laptops",
    image: "/images/hero/hero-gaming-laptops.svg",
    accent: "from-violet-500 to-fuchsia-500",
    placement: "hero",
    sortOrder: 1,
    active: true,
  },
  {
    id: "b3",
    eyebrow: "Find the exact fit",
    title: "Chargers, batteries & parts for your laptop",
    subtitle: "Select your laptop model and see compatible chargers, batteries, keyboards and RAM in seconds.",
    ctaLabel: "Find my parts",
    ctaHref: "/find-parts",
    image: "/images/hero/hero-laptop-parts.svg",
    accent: "from-cyan-500 to-blue-500",
    placement: "hero",
    sortOrder: 2,
    active: true,
  },
  {
    id: "b4",
    eyebrow: "Apple M2",
    title: "MacBook Air M2",
    subtitle: "Box packed with 1 year warranty.",
    ctaLabel: "Buy now",
    ctaHref: "/laptops/apple-macbook-air-m2-8gb-256gb",
    image: "/images/products/apple-macbook-air-m2-8gb-256gb-1.svg",
    placement: "promo",
    sortOrder: 0,
    active: true,
  },
];

export const seedSettings: StoreSettings = {
  freeDeliveryThreshold: 15000,
  defaultDeliveryCharge: 350,
  cityCharges: { Karachi: 200, Lahore: 300, Islamabad: 300, Rawalpindi: 300 },
  advanceThreshold: 100000,
  advanceAmount: 5000,
  bank: { bankName: "Meezan Bank", accountTitle: "Urko Tech Store", accountNumber: "0000-0000000000", iban: "PK00MEZN0000000000000000" },
  jazzcash: { title: "Urko Tech Store", number: "0342-6693115" },
  easypaisa: { title: "Urko Tech Store", number: "0343-5867409" },
  announcement: "Free delivery on orders above Rs 15,000 · Cash on Delivery all over Pakistan",
};

export const seedCoupons: Coupon[] = [
  { code: "WELCOME5", kind: "percent", value: 5, minOrder: 5000, expiresAt: null, usageLimit: null, used: 0, active: true },
  { code: "URKO1000", kind: "fixed", value: 1000, minOrder: 50000, expiresAt: null, usageLimit: 500, used: 0, active: true },
];

export const seedFlashSales: FlashSale[] = [
  {
    id: "fs-weekly",
    title: "Weekly Hot Deals",
    endsAt: SEED_DEAL_END,
    productIds: ["p-hp-elitebook-840-g8", "p-lenovo-thinkpad-t14", "p-hp-probook-450-g8", "p-msi-gf63-rtx-4050"],
    active: true,
  },
];

export const seedRedirects: Redirect[] = [{ fromPath: "/shop/laptops", toPath: "/category/laptops", permanent: true }];

export const seedFaqs: FaqItem[] = [
  { group: "Orders & Payment", q: "Do you offer Cash on Delivery all over Pakistan?", a: "Yes. Cash on Delivery (COD) is available in every city of Pakistan. For high-value orders above Rs 100,000 we may ask for a small advance (Rs 5,000) via JazzCash, EasyPaisa or bank transfer to confirm the order." },
  { group: "Orders & Payment", q: "Which payment methods do you accept?", a: "Cash on Delivery, JazzCash, EasyPaisa and bank transfer. Card payments are coming soon. For online transfers, upload the payment screenshot at checkout so we can verify it quickly." },
  { group: "Orders & Payment", q: "How do I order on WhatsApp?", a: "Tap “Order on WhatsApp” on any product page or message us at +92 342 6693115 or +92 343 5867409. Share the product link, your name, city and address and we will confirm your order." },
  { group: "Delivery", q: "How long does delivery take?", a: "Karachi: same day or next day. Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad and Sialkot: 1–3 working days. Other cities: 3–5 working days." },
  { group: "Delivery", q: "Which courier do you use?", a: "We ship with TCS, Leopards, M&P, Trax, PostEx and Call Courier depending on your city. You get a tracking number as soon as your order is dispatched." },
  { group: "Delivery", q: "How much are delivery charges?", a: "Delivery is free on orders above Rs 15,000. Below that, charges start from Rs 200 in Karachi and Rs 300–350 for other cities." },
  { group: "Products & Warranty", q: "What do Used A+, Used A and Refurbished mean?", a: "Used A+ means like-new with no visible marks. Used A has light signs of use. Refurbished laptops are professionally restored with parts replaced where needed. Every laptop is checked & tested on 30+ points before listing." },
  { group: "Products & Warranty", q: "Do used laptops come with warranty?", a: "Yes. Used laptops come with a checking warranty (usually 1–3 months) and refurbished laptops with up to 6 months warranty. New laptops carry official brand warranty." },
  { group: "Products & Warranty", q: "How do I find the right charger or battery for my laptop?", a: "Use our “Find Parts for Your Laptop” tool: choose your laptop brand and model and we will show compatible chargers, batteries, keyboards and RAM. You can also send us a photo of your old part on WhatsApp." },
  { group: "Returns", q: "What is your return policy?", a: "If you receive a wrong, damaged or faulty product, report it within 3 days of delivery and we will replace or refund it. See our Warranty & Return Policy for full details." },
  { group: "Store", q: "Where is your shop?", a: "Our shop is at Regal Trade Square, Regal Chowk, Saddar, Karachi. You are welcome to visit, check laptops in person and pick up your order." },
  { group: "Store", q: "Do you offer installments?", a: "We are working with partner banks to offer easy installment plans. Contact us on WhatsApp for the latest options." },
];
