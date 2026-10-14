/**
 * The original (default) store's built-in business profile – NAP (name, address, phone), hours and socials of the shop
 * ShopEngine started as. Keep it identical to that shop's Google Business Profile listing.
 * Only the default store starts from these (see `DEFAULT_SITE_INFO` in site-info.ts); every other store has its own
 * profile, so storefront code reads the current store's details with `getSiteInfo()` / `useSiteInfo()`, never these.
 * `site.url` / `absoluteUrl()` are the main site address (NEXT_PUBLIC_SITE_URL).
 */
export const site = {
  name: "Urko Tech Store",
  shortName: "Urko Tech",
  tagline: "Laptops & Tech Accessories – Delivered All Over Pakistan",
  description:
    "Urko Tech Store in Saddar, Karachi sells new, used and refurbished laptops plus chargers, batteries, keyboards, mouse, SSDs, RAM and accessories with Cash on Delivery all over Pakistan.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://urkotechstore.com").replace(/\/$/, ""),
  email: "info@urkotechstore.com",
  address: {
    street: "Regal Trade Square, Regal Chowk",
    area: "Saddar",
    city: "Karachi",
    region: "Sindh",
    postalCode: "74400",
    country: "Pakistan",
    countryCode: "PK",
    full: "Regal Trade Square, Regal Chowk, Saddar, Karachi, Pakistan",
  },
  geo: { lat: 24.8607, lng: 67.0262 },
  phones: [
    { label: "Sales 1", display: "+92 342 6693115", tel: "+923426693115", wa: "923426693115" },
    { label: "Sales 2", display: "+92 343 5867409", tel: "+923435867409", wa: "923435867409" },
  ],
  // Opening hours used in LocalBusiness schema and the Contact page. Update to match Google Business Profile.
  hours: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "11:00", closes: "21:00" },
  ],
  hoursDisplay: "Mon – Sat: 11:00 AM – 9:00 PM · Sunday: Closed (online orders 24/7)",
  social: {
    facebook: "https://www.facebook.com/urkotechstore",
    instagram: "https://www.instagram.com/urkotechstore",
    tiktok: "https://www.tiktok.com/@urkotechstore",
    youtube: "https://www.youtube.com/@urkotechstore",
  },
  mapEmbed:
    "https://www.google.com/maps?q=Regal+Trade+Square,+Regal+Chowk,+Saddar,+Karachi&output=embed",
  mapLink: "https://www.google.com/maps/search/?api=1&query=Regal+Trade+Square+Regal+Chowk+Saddar+Karachi",
  couriers: ["TCS", "Leopards", "M&P", "Trax", "PostEx", "Call Courier"] as const,
} as const;

export type Courier = (typeof site.couriers)[number];

/** WhatsApp chat link – pass the current store's number (e.g. `primaryPhone(info).wa`). */
export function waLink(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
