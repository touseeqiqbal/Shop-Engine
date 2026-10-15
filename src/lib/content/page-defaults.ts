/**
 * Built-in Markdown for the editable content pages, written with {{tokens}} so store details
 * (phones, address, delivery charges…) stay in sync with /cms → Settings → Store details / Delivery settings.
 * Client-safe. Rendered through `fillTokens()`.
 */
import type { SiteInfo } from "@/lib/site-info";
import type { StoreSettings } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { deliveryCharge } from "@/lib/cities";

export const CONTENT_TOKENS: { token: string; help: string }[] = [
  { token: "storeName", help: "Store name" },
  { token: "address", help: "Full address" },
  { token: "email", help: "Email" },
  { token: "phone1", help: "First phone (display)" },
  { token: "phone2", help: "Second phone (display)" },
  { token: "phones", help: "All phones, comma separated" },
  { token: "phonesSlash", help: "All phones joined with “ / ”" },
  { token: "phonesOr", help: "All phones joined with “ or ”" },
  { token: "phonesLine", help: "“, or call / WhatsApp …” – empty without phones" },
  { token: "hours", help: "Opening hours text" },
  { token: "domain", help: "Website domain" },
  { token: "couriers", help: "Courier partners" },
  { token: "freeDelivery", help: "Free-delivery threshold" },
  { token: "chargeKarachi", help: "Delivery charge – Karachi" },
  { token: "chargeLahore", help: "Delivery charge – Lahore" },
  { token: "chargeDefault", help: "Default delivery charge" },
  { token: "advanceThreshold", help: "COD advance applies above" },
  { token: "advanceAmount", help: "COD advance amount" },
];

/** `money` = the store's money formatter (`await getMoney()`); the original shop's rupees when left out. */
export function tokenValues(info: SiteInfo, settings?: StoreSettings | null, money: (amount: number) => string = formatMoney): Record<string, string> {
  const displays = info.phones.map((p) => p.display);
  // same rules as checkout: the zone's charge for that city (/cms → Delivery & payments → Delivery charges)
  const charge = (city: string) => (settings ? money(deliveryCharge(city, 0, settings)) : "");
  return {
    storeName: info.name,
    address: info.address.full,
    email: info.email,
    phone1: displays[0] ?? "",
    phone2: displays[1] ?? displays[0] ?? "",
    phones: displays.join(", "),
    phonesSlash: displays.join(" / "),
    phonesOr: displays.join(" or "),
    // ", call or WhatsApp 0300…" – empty when the store has no phone yet
    phonesLine: displays.length ? `, or call / WhatsApp ${displays.join(" / ")}` : "",
    hours: info.hoursDisplay,
    domain: info.url.replace(/^https?:\/\//, ""),
    couriers: info.couriers.join(", "),
    freeDelivery: settings ? money(settings.freeDeliveryThreshold) : "",
    chargeKarachi: charge("Karachi"),
    chargeLahore: charge("Lahore"),
    chargeDefault: settings ? money(settings.defaultDeliveryCharge) : "",
    advanceThreshold: settings ? money(settings.advanceThreshold) : "",
    advanceAmount: settings ? money(settings.advanceAmount) : "",
  };
}

/** Replace {{token}} placeholders; unknown tokens are left as-is. */
export function fillTokens(md: string, values: Record<string, string>) {
  return md.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in values ? values[k] : m));
}

// ───────────────────────────── default bodies ─────────────────────────────

const SHIPPING = `## Order processing

- Orders placed before **5:00 PM (Mon–Sat)** are usually confirmed and dispatched the **same day**. Orders placed later, or on Sundays and public holidays, are dispatched the next working day.
- For every order we send a confirmation on WhatsApp or by phone call. Please keep your phone on – **unconfirmed orders are not dispatched**.
- Laptops are tested again and packed with bubble wrap and a sturdy box before dispatch.

## Delivery charges

- **Free delivery** on all orders of **{{freeDelivery}} or more**.
- Below that, a flat delivery charge applies: {{chargeKarachi}} in Karachi and {{chargeLahore}}–{{chargeDefault}} for other cities. The exact charge is shown at checkout before you place your order.
- Remote areas may occasionally carry an additional courier surcharge; we will tell you before dispatch.

## Cash on Delivery (COD)

Cash on Delivery is available **all over Pakistan**. Pay the rider in cash when your parcel arrives. For orders above **{{advanceThreshold}}**, we may ask for an advance of **{{advanceAmount}}** via JazzCash, EasyPaisa or bank transfer to confirm the order – the rest is paid on delivery. Prepaid orders (bank transfer, JazzCash, EasyPaisa) are dispatched as soon as the payment is verified.

## Couriers and tracking

We ship with **{{couriers}}**, choosing the fastest and most reliable option for your city. As soon as your parcel is dispatched you'll receive the **courier name and tracking number** by WhatsApp/SMS. You can also check status on our [track order](/track-order) page.

## Store pickup in Saddar, Karachi

Prefer to collect in person? Message us to arrange pickup and collect your order from **{{address}}** during store hours ({{hours}}). You can check the laptop in front of our team before paying.

## Receiving your parcel

- Please check that the parcel is **sealed and undamaged** before accepting it. If the box is visibly damaged, you may refuse it or note it with the rider and contact us immediately.
- We recommend recording an **unboxing video** for laptops and high-value items.
- Report a wrong, damaged or faulty item within **3 days** – see our [warranty & return policy](/warranty-returns).

## Delays

Delivery times are estimates in working days. Delays can happen due to weather, strikes, public holidays, Eid rush or security situations beyond our control. If your order is late, contact us and we'll follow up with the courier straight away.

## Refused or failed deliveries

If a COD parcel is refused without a valid reason, or cannot be delivered after repeated attempts because of an incorrect address or unreachable phone, we may ask for the two-way delivery charges before accepting a future COD order.

## Contact

Questions about delivery? WhatsApp or call {{phonesSlash}} or email {{email}}.`;

const WARRANTY = `## Checking warranty – what it covers

A **checking warranty** covers hardware faults that were not visible or reported at the time of sale and that appear during normal use within the warranty period – for example a motherboard fault, a failed SSD or RAM module, a dead keyboard or a display fault that develops on its own.

During the warranty period we will, at our option, **repair**, **replace the faulty part** or **replace the product** with one of equal value. If a repair or replacement is not possible, we will issue a refund or store credit for the purchase price of the affected item.

## What is not covered

- Physical damage: cracked screens, broken hinges, dents, liquid / water damage or burn marks
- Damage caused by power surges, unstable voltage, or using a wrong or duplicate charger
- Software problems, viruses, forgotten passwords, data loss or operating-system issues
- Normal wear such as battery capacity reducing over time, or cosmetic marks already described in the condition notes
- Products opened, repaired or modified by anyone other than {{storeName}} or the brand's authorised service centre
- Removed, damaged or tampered warranty stickers / serial numbers
- Consumables and freebies (bags, mouse pads, cables given free with a laptop)

> **Battery note:** On used laptops the battery health at the time of sale is listed on the product page. Battery health is not covered by checking warranty unless stated otherwise, but we're happy to quote a replacement battery and fit it for free at our shop.

## 3-day replacement for wrong, damaged or faulty items

If you receive a product that is **wrong**, **damaged in transit** or **dead on arrival**, contact us within **3 days of delivery** on WhatsApp at {{phonesOr}} with:

1. Your order number
2. Photos or a short video of the issue (and of the parcel if it was damaged in transit)
3. A description of the problem

After we confirm the issue, we'll arrange a **free replacement** or a **full refund**, including delivery charges.

### Please record an unboxing video

For high-value items like laptops, we strongly recommend recording a short video while opening the parcel. It makes any transit-damage claim quick and easy for both of us.

## Change-of-mind returns

Because many of our products are used, refurbished or compatibility-specific parts, we do not offer change-of-mind refunds as standard. However, if you contact us **within 3 days of delivery** and the product is **unused, in its original condition and packaging**, we may accept an exchange or store credit at our discretion. In such cases the customer pays the return delivery charges, and a restocking fee may apply.

Parts ordered for a specific laptop model (chargers, batteries, keyboards, RAM) are only returnable if they are faulty or we supplied the wrong part. Please use our [Find Parts tool](/find-parts) or confirm compatibility with us on WhatsApp before ordering.

## How to make a warranty claim

1. **Contact us** on WhatsApp or by phone with your order number and a description of the fault.
2. **Basic troubleshooting:** our team may ask you to try a few simple steps – many issues are solved remotely.
3. **Send or bring the product:** Karachi customers can visit our shop at {{address}}. Customers outside Karachi can send the product by courier; we'll share the address and packing instructions.
4. **Inspection and repair:** most claims are resolved within **3–7 working days** after we receive the product. Brand-warranty claims follow the brand service centre's timeline.
5. **Return delivery:** for valid warranty claims, we pay the delivery charges to send the repaired or replaced product back to you.

## Refunds

Approved refunds are processed within **3–7 working days** after we receive and inspect the returned product. Refunds are made via bank transfer, JazzCash or EasyPaisa to the account you provide. For Cash on Delivery orders, delivery charges are refunded only when the return is due to our error.

## Data and accessories

Please **back up and remove your personal data** before sending a laptop for warranty service. We are not responsible for data on returned devices. Return all accessories (charger, cables, box) that came with the product.

## Questions?

Email {{email}}, call or WhatsApp {{phonesSlash}}, or visit our shop in Saddar. See also our [shipping policy](/shipping-policy), [terms & conditions](/terms) and [FAQs](/faqs).`;

const PRIVACY = `This Privacy Policy explains how **{{storeName}}** ("we", "us", "our"), located at {{address}}, collects, uses and protects your personal information when you visit {{domain}}, place an order, or contact us by phone, WhatsApp or email. By using our website you agree to this policy.

## Information we collect

### Information you give us
- **Order details:** name, mobile number, email (optional), city, delivery address and landmark
- **Account details:** name, email, phone and password (stored only in encrypted/hashed form) if you create an account
- **Payment proof:** screenshots of bank, JazzCash or EasyPaisa transfers you upload for verification
- **Messages:** anything you send through our contact form, WhatsApp, phone calls or email
- **Reviews:** your name, city and review text if you review a product

### Information collected automatically
- Device and browser type, IP address, pages visited and referring website
- Cart, wishlist, compare list and theme preferences stored in your browser (local storage)
- Cookies needed for login sessions and security, and – if enabled – analytics cookies (Google Analytics) and advertising pixels (Meta Pixel)

We do **not** collect or store debit/credit card numbers on our servers.

## How we use your information

- To confirm, process, ship and deliver your orders, and to provide tracking updates
- To contact you about your order by phone, SMS, WhatsApp or email
- To handle warranty claims, returns and customer support
- To prevent fraud, fake orders and abuse of our website (for example, rate-limiting forms)
- To improve our website, product range and service using aggregated analytics
- To send offers or updates **only if you have opted in** – you can opt out at any time

## Sharing your information

We only share your information when necessary:
- **Courier companies** ({{couriers}}) receive your name, phone, city and address to deliver your parcel and collect Cash on Delivery
- **Payment partners and banks** when verifying a transfer
- **Service providers** that host our website, database, file storage and email, under confidentiality obligations
- **Authorities** when required by Pakistani law or to protect our rights and customers

We **never sell** your personal information to anyone.

## Data retention

We keep order records for as long as needed for warranty, accounting and legal purposes (typically up to 5 years). Contact-form messages are kept for up to 2 years. You can ask us to delete your account and personal data at any time, subject to legal record-keeping requirements.

## Security

We use HTTPS encryption, hashed passwords, restricted staff access and private storage for payment screenshots. No website is 100% secure, so please keep your account password private and let us know immediately if you suspect misuse.

## Your rights

You can ask us to:
- Access a copy of the personal information we hold about you
- Correct inaccurate information
- Delete your account and personal data
- Stop sending you marketing messages

To make a request, email **{{email}}** or WhatsApp {{phone1}}. We'll respond within 14 days.

## Cookies

Essential cookies keep you logged in and protect our forms. Analytics and advertising cookies help us understand how the site is used and show relevant ads. You can block or delete cookies in your browser settings – essential features like login may stop working if you do.

## Children

Our website is not directed at children under 13. Parents or guardians should place orders on behalf of minors.

## Third-party links

Our website links to WhatsApp, Google Maps, Facebook, Instagram, TikTok and YouTube. Their privacy practices are governed by their own policies.

## Changes to this policy

We may update this policy from time to time. The "last updated" date at the top of this page shows when it was last changed.

## Contact us

{{storeName}} · {{address}}
Email: {{email}} · Phone/WhatsApp: {{phones}}`;

const TERMS = `These Terms & Conditions apply to all purchases from **{{storeName}}**, whether made on our website, on WhatsApp, by phone or at our shop at {{address}}. By placing an order you agree to these terms.

## 1. Products and descriptions

- We describe every product as accurately as possible, including **condition grade** (New, Open Box, Refurbished, Used A+, Used A), specifications, battery health and condition notes for used laptops.
- Product photos may be representative. For used and refurbished laptops, small cosmetic differences between units of the same grade are normal.
- Specifications provided by manufacturers may change without notice. If a detail matters to you, confirm it with us on WhatsApp before ordering.

## 2. Prices

- All prices are in **Pakistani Rupees (PKR)** and include applicable taxes unless stated otherwise.
- Laptop prices in Pakistan change frequently with exchange rates and supply. The price shown at the time you place your order is the price you pay.
- If a product is listed at an obviously incorrect price due to a technical or typing error, we may cancel the order and inform you before dispatch.

## 3. Orders and confirmation

- An order is a request to buy. It becomes a contract only when we **confirm it** by phone, WhatsApp or SMS.
- We may refuse or cancel an order if the product is out of stock, the delivery details cannot be verified, or we suspect a fake or fraudulent order. Any advance paid will be refunded in full.
- Coupon codes cannot be combined unless stated, have no cash value, and may have minimum order values and expiry dates.

## 4. Payment

- We accept **Cash on Delivery**, **JazzCash**, **EasyPaisa** and **bank transfer**. Card payments will be added soon.
- For orders above a certain value we may ask for a small advance to confirm the order – the exact amount is shown at checkout and in our [shipping policy](/shipping-policy).
- For prepaid orders, please upload a clear payment screenshot. Orders are dispatched once the payment is verified.

## 5. Delivery

Delivery times and charges are explained in our [shipping policy](/shipping-policy). Delivery estimates are not guaranteed and may be affected by events outside our control. Risk in the product passes to you when it is delivered to you or your nominee.

## 6. Warranty and returns

Warranty terms depend on the product and are shown on each product page and in our [warranty & return policy](/warranty-returns). Wrong, damaged or faulty items must be reported within 3 days of delivery.

## 7. Customer responsibilities

- Provide a correct name, phone number and complete address, and be available to receive the parcel.
- Check the parcel at delivery and record an unboxing video for laptops where possible.
- Use products according to the manufacturer's instructions, with the correct charger and stable power supply.
- Back up your data before sending any device for repair or warranty service.

## 8. Accounts

You are responsible for keeping your account password confidential and for all activity under your account. We may suspend accounts used for fraud, abuse or fake orders.

## 9. Reviews and content

Reviews must be honest and about your own experience. We may moderate or remove reviews that are abusive, misleading, spam or unrelated to the product.

## 10. Intellectual property

All website content – text, graphics, logos, product photos and design – belongs to {{storeName}} or its licensors and may not be copied without written permission. Brand names such as HP, Dell, Lenovo, Apple, Asus, MSI, Logitech and Razer are trademarks of their respective owners.

## 11. Limitation of liability

To the maximum extent permitted by law, our liability for any product is limited to the price you paid for it. We are not liable for indirect losses such as loss of data, business or profit. Nothing in these terms limits your rights under applicable Pakistani consumer protection laws.

## 12. Governing law

These terms are governed by the laws of Pakistan. Any dispute will be subject to the jurisdiction of the courts of **Karachi, Sindh**.

## 13. Changes

We may update these terms from time to time. The version published on this page at the time of your order applies to that order.

## Contact

{{storeName}} · {{address}}
Email: {{email}} · Phone/WhatsApp: {{phones}}`;

const ABOUT_STORY = `Anyone who has shopped for **laptops in Saddar, Karachi** knows the feeling: dozens of shops, hundreds of models and prices that change by the hour. We opened {{storeName}} at **Regal Trade Square, Regal Chowk** with a simple idea – tell customers exactly what they are buying, and stand behind it.

Every used laptop is graded honestly, its battery health is written on the listing, and the condition notes mention even small marks. That approach turned walk-in customers into regulars – and regulars started sending friends and family from Lahore, Islamabad, Peshawar and Quetta.

So we brought the shop online. Today you can **buy a laptop online in Pakistan** from our store, pay with Cash on Delivery and receive it in 1–5 working days – or visit us in Saddar and check it in person before you pay.`;

// ───────────────────────────── texts for other stores ─────────────────────────────
// The texts above describe the original shop (its Karachi shop, market and courts). Every other store starts from these
// plain versions – filled with its own name, address and delivery prices – until it saves its own in /cms.

const SHIPPING_PLAIN = `## Order processing

- Orders are usually confirmed and dispatched within **1–2 working days**. Orders placed on weekends or public holidays are dispatched the next working day.
- We may call or message you to confirm your order – please keep your phone on.

## Delivery charges

- **Free delivery** on orders of **{{freeDelivery}} or more** (when offered).
- Below that, a delivery charge applies; the exact charge for your city is shown at checkout before you place your order.

## Payment on delivery

Where Cash on Delivery is offered, pay the rider when your parcel arrives. For larger orders we may ask for part of the amount in advance to confirm the order. Prepaid orders are dispatched as soon as the payment is confirmed.

## Tracking

As soon as your parcel is dispatched you'll receive the courier name and tracking number. You can also check status on our [track order](/track-order) page.

## Receiving your parcel

- Please check that the parcel is **sealed and undamaged** before accepting it, and contact us straight away if it isn't.
- Report a wrong, damaged or faulty item as soon as possible – see our [returns policy](/warranty-returns).

## Delays

Delivery times are estimates in working days and can be affected by events outside our control. If your order is late, contact us and we'll follow up with the courier.

## Contact

Questions about delivery? Contact us at {{email}}{{phonesLine}}.`;

const RETURNS_PLAIN = `## Wrong, damaged or faulty items

If you receive a product that is **wrong**, **damaged in transit** or **faulty**, contact us as soon as possible with your order number, a description of the problem and photos. Once we confirm the issue we'll arrange a **replacement** or a **refund**.

## Warranty

Warranty terms depend on the product and are shown on each product page. Warranty does not cover physical or liquid damage, misuse, or products repaired or modified by others.

## Change-of-mind returns

If you change your mind, contact us before sending anything back. Items must be unused and in their original packaging; return delivery is paid by the customer unless the return is due to our error.

## How to return an item

1. **Contact us** with your order number – or use the [returns page](/returns).
2. **Send the item back** using the instructions we give you.
3. **Inspection:** we check the item and confirm a replacement, repair or refund.

## Refunds

Approved refunds are made to the original payment method (or the account you give us for cash payments) after we receive and check the item.

## Questions?

Contact us at {{email}}{{phonesLine}}. See also our [shipping policy](/shipping-policy) and [terms & conditions](/terms).`;

const ABOUT_PLAIN = `{{storeName}} is an online store. We describe every product honestly, keep you informed from order to delivery, and stand behind what we sell.

Questions before you buy? Contact us at {{email}}{{phonesLine}} – we're happy to help.`;

/** The original shop's texts, adjusted for every other store (keys present here replace the field). */
const PLAIN_PAGE_CONTENT: Record<string, { eyebrow?: string; title?: string; description?: string; body?: string; intro?: string }> = {
  "/shipping-policy": { eyebrow: "Delivery", description: "How we deliver your order, what it costs and how to track it.", body: SHIPPING_PLAIN },
  "/warranty-returns": { eyebrow: "Peace of mind", title: "Returns & *Warranty*", description: "If something isn't right with your order, we'll make it right.", body: RETURNS_PLAIN },
  "/terms": { description: "The rules that apply when you buy from {{storeName}}." },
  "/installments": { description: "Pay in easy instalments where available – ask us for the current options." },
  "/about": { eyebrow: "About us", title: "About *{{storeName}}*", description: "Who we are and how we work.", body: ABOUT_PLAIN },
  "/shop": { intro: "Browse everything we sell – delivered to your door." },
  "/category": { intro: "Browse our categories." },
  "/deals": { intro: "Our best prices right now." },
  "/find-parts": { intro: "Find the right part for your device." },
  "/brands": { intro: "Shop by brand." },
  "/blog": { intro: "News, guides and tips from {{storeName}}." },
};

/**
 * Terms: the original shop names its city's courts, Pakistani rupees, its wallets and Pakistani law; other stores (any
 * country, any currency) refer to their own place of business and checkout.
 */
const plainTerms = (body: string) =>
  body
    .replace("the courts of **Karachi, Sindh**", "the courts where {{storeName}} has its place of business")
    .replace(", by phone or at our shop at {{address}}", " or by phone")
    .replace("All prices are in **Pakistani Rupees (PKR)** and include", "All prices are in the currency shown on our website and include")
    .replace("Laptop prices in Pakistan change frequently with exchange rates and supply.", "Prices can change with exchange rates and supply.")
    .replace("We accept **Cash on Delivery**, **JazzCash**, **EasyPaisa** and **bank transfer**. Card payments will be added soon.", "The payment methods we accept are shown at checkout.")
    .replace("applicable Pakistani consumer protection laws", "applicable consumer protection laws")
    .replace("governed by the laws of Pakistan", "governed by applicable law");

/** Privacy: Pakistani law and wallets are the original shop's; other stores follow their own. */
const plainPrivacy = (body: string) => body.replace("when required by Pakistani law", "when required by law").replace("screenshots of bank, JazzCash or EasyPaisa transfers", "screenshots of bank or online transfers");

/** Built-in content per page key (fields not listed are rendered from the page's own JSX). */
export const DEFAULT_PAGE_CONTENT: Record<string, { eyebrow?: string; title?: string; description?: string; body?: string; intro?: string; seoCopy?: string; updated?: string }> = {
  "/shipping-policy": {
    eyebrow: "Delivery all over Pakistan",
    title: "Shipping & *Delivery Policy*",
    description: "Fast, tracked delivery from our Saddar, Karachi store to every city in Pakistan – with Cash on Delivery.",
    body: SHIPPING,
    updated: "2026-09-01",
  },
  "/warranty-returns": {
    eyebrow: "Peace of mind",
    title: "Warranty & *Return Policy*",
    description: "Every laptop and part we sell is checked & tested in our Saddar, Karachi shop. If something isn't right, we'll make it right.",
    body: WARRANTY,
    updated: "2026-09-01",
  },
  "/privacy-policy": {
    eyebrow: "Policies",
    title: "Privacy *Policy*",
    description: "Your trust matters. Here's exactly what information we collect, why we collect it and how we keep it safe.",
    body: PRIVACY,
    updated: "2026-09-01",
  },
  "/terms": {
    eyebrow: "Policies",
    title: "Terms & *Conditions*",
    description: "The simple rules that apply when you buy laptops and accessories from {{storeName}} – online or in store.",
    body: TERMS,
    updated: "2026-09-01",
  },
  "/installments": {
    eyebrow: "Easy payments",
    title: "Laptops on *easy installments*",
    description:
      "Get the laptop you need today and pay in easy monthly instalments. We're partnering with leading banks in Pakistan to launch instalment plans soon.",
    body: "",
    updated: "2026-09-15",
  },
  "/about": {
    eyebrow: "Our story",
    title: "A trusted *laptop shop in Saddar, Karachi* – now serving all of Pakistan",
    description:
      "{{storeName}} started at a small counter in the busy **Regal Chowk laptop market**. Today we help students, freelancers, offices and gamers in every city buy the right laptop – with honest grading, real warranty and Cash on Delivery.",
    body: ABOUT_STORY,
  },
  "/shop": {
    intro: "New, used & refurbished laptops plus every accessory you need – checked, tested and delivered all over Pakistan with Cash on Delivery.",
    seoCopy: "",
  },
  "/category": {
    intro: "Laptops, parts and peripherals – every item checked & tested at our Saddar, Karachi store and delivered all over Pakistan.",
    seoCopy: "",
  },
  "/deals": {
    intro: "Our best prices on laptops and accessories – checked, tested and delivered all over Pakistan with Cash on Delivery.",
    seoCopy: "",
  },
  "/find-parts": {
    intro: "Pick your laptop and see only the chargers, batteries, keyboards, RAM and SSDs that fit – no guesswork, no wrong orders.",
    seoCopy: "",
  },
  "/brands": {
    intro: "Genuine laptops, parts and peripherals from the brands you trust – with warranty and Cash on Delivery all over Pakistan.",
    seoCopy: "",
  },
  "/blog": {
    intro: "Honest advice from our team at the Regal Chowk laptop market in Saddar, Karachi – so you buy the right laptop, charger or accessory the first time.",
    seoCopy: "",
  },
};

export type ResolvedPageContent = { eyebrow: string; title: string; description: string; body: string; intro: string; seoCopy: string; updated: string };

/** Saved content (non-empty fields) layered over the built-in defaults for `key`. */
export function resolvePageContent(key: string, saved: Partial<ResolvedPageContent> | null | undefined, opts: { original?: boolean } = {}): ResolvedPageContent {
  const base = DEFAULT_PAGE_CONTENT[key] ?? {};
  // the original shop keeps its own texts; every other store gets the plain ones (its own name and details)
  const plainBody = key === "/terms" ? plainTerms : key === "/privacy-policy" ? plainPrivacy : null;
  const d = opts.original === false ? { ...base, ...(plainBody && base.body ? { body: plainBody(base.body) } : {}), ...(PLAIN_PAGE_CONTENT[key] ?? {}) } : base;
  const pick = (k: keyof ResolvedPageContent) => {
    const v = saved?.[k];
    return typeof v === "string" && v.trim() ? v : d[k] ?? "";
  };
  return {
    eyebrow: pick("eyebrow"),
    title: pick("title"),
    description: pick("description"),
    body: pick("body"),
    intro: pick("intro"),
    seoCopy: pick("seoCopy"),
    updated: /^\d{4}-\d{2}-\d{2}$/.test(saved?.updated ?? "") ? saved!.updated! : d.updated ?? "",
  };
}
