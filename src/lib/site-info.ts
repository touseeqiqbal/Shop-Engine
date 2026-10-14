import { site } from "./site";

/**
 * Admin-editable business profile (NAP, hours, socials). Client-safe: no server imports.
 * `site` (src/lib/site.ts) holds the built-in defaults; saved overrides (setting key `business`)
 * are merged on top by `mergeSiteInfo()`. `url` always comes from the environment.
 */

export interface SitePhone {
  label: string;
  display: string;
  /** E.164, e.g. +923001234567 – used for tel: links */
  tel: string;
  /** WhatsApp number without +, e.g. 923001234567 */
  wa: string;
}

export interface SiteHoursRow {
  days: string[];
  opens: string;
  closes: string;
}

export const SOCIAL_NETWORKS = [
  { key: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/yourpage" },
  { key: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/yourhandle" },
  { key: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@yourhandle" },
  { key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@yourchannel" },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/yourcompany" },
  { key: "pinterest", label: "Pinterest", placeholder: "https://www.pinterest.com/yourhandle" },
  { key: "threads", label: "Threads", placeholder: "https://www.threads.net/@yourhandle" },
] as const;
export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface SiteInfo {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  url: string;
  email: string;
  address: {
    street: string;
    area: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    countryCode: string;
    full: string;
  };
  geo: { lat: number; lng: number };
  phones: SitePhone[];
  hours: SiteHoursRow[];
  hoursDisplay: string;
  /** Short reply-time note in the WhatsApp popup, e.g. "Typically replies within minutes · 11am – 9pm" */
  whatsappNote: string;
  /** network key → profile URL (empty / missing = hidden) */
  social: Partial<Record<SocialKey, string>>;
  mapEmbed: string;
  mapLink: string;
  couriers: string[];
}

/** Saved shape – every field optional; missing fields fall back to the defaults. */
export type SiteInfoOverrides = Partial<Omit<SiteInfo, "url" | "address" | "geo">> & {
  address?: Partial<SiteInfo["address"]>;
  geo?: Partial<SiteInfo["geo"]>;
};

export const DEFAULT_SITE_INFO: SiteInfo = {
  name: site.name,
  shortName: site.shortName,
  tagline: site.tagline,
  description: site.description,
  url: site.url,
  email: site.email,
  address: { ...site.address },
  geo: { ...site.geo },
  phones: site.phones.map((p) => ({ ...p })),
  hours: site.hours.map((h) => ({ days: [...h.days], opens: h.opens, closes: h.closes })),
  hoursDisplay: site.hoursDisplay,
  whatsappNote: "Typically replies within minutes · 11am – 9pm",
  social: { ...site.social },
  mapEmbed: site.mapEmbed,
  mapLink: site.mapLink,
  couriers: [...site.couriers],
};

const nonEmpty = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";

/**
 * A new store's starting profile: its own name and address, nothing else (no phone numbers, socials or map of any
 * other business). The owner fills the rest in Settings → Store details.
 */
export function blankSiteInfo(name: string, url: string, country = ""): SiteInfo {
  return {
    name,
    shortName: name,
    tagline: "",
    description: "",
    url,
    email: "",
    address: { street: "", area: "", city: "", region: "", postalCode: "", country, countryCode: "", full: "" },
    geo: { lat: 0, lng: 0 },
    phones: [],
    hours: [],
    hoursDisplay: "",
    whatsappNote: "",
    social: {},
    mapEmbed: "",
    mapLink: "",
    couriers: [],
  };
}

/** Merge saved overrides onto the defaults (`base`: the store's starting profile). Empty strings / empty lists keep the default. */
export function mergeSiteInfo(saved: SiteInfoOverrides | null | undefined, base: SiteInfo = DEFAULT_SITE_INFO): SiteInfo {
  const d = base;
  if (!saved || typeof saved !== "object") return structuredClone(d);
  const pick = (v: unknown, fallback: string) => (nonEmpty(v) ? v.trim() : fallback);
  const address = { ...d.address };
  for (const k of Object.keys(address) as (keyof SiteInfo["address"])[]) address[k] = pick(saved.address?.[k], d.address[k]);
  const lat = Number(saved.geo?.lat);
  const lng = Number(saved.geo?.lng);
  const phones = Array.isArray(saved.phones) ? saved.phones.filter((p) => p && nonEmpty(p.display) && (nonEmpty(p.tel) || nonEmpty(p.wa))) : [];
  const hours = Array.isArray(saved.hours) ? saved.hours.filter((h) => h && Array.isArray(h.days) && h.days.length && h.opens && h.closes) : [];
  // Socials: an explicitly saved object replaces the defaults entirely (so a network can be removed).
  const social: SiteInfo["social"] = {};
  if (saved.social && typeof saved.social === "object") {
    for (const n of SOCIAL_NETWORKS) if (nonEmpty(saved.social[n.key])) social[n.key] = saved.social[n.key]!.trim();
  }
  return {
    name: pick(saved.name, d.name),
    shortName: pick(saved.shortName, d.shortName),
    tagline: pick(saved.tagline, d.tagline),
    description: pick(saved.description, d.description),
    url: d.url,
    email: pick(saved.email, d.email),
    address,
    geo: { lat: Number.isFinite(lat) && saved.geo?.lat != null ? lat : d.geo.lat, lng: Number.isFinite(lng) && saved.geo?.lng != null ? lng : d.geo.lng },
    phones: phones.length
      ? phones.map((p) => ({ label: p.label?.trim() || "Sales", display: p.display.trim(), tel: (p.tel || `+${p.wa}`).trim(), wa: (p.wa || p.tel).replace(/\D/g, "") }))
      : d.phones.map((p) => ({ ...p })),
    hours: hours.length ? hours.map((h) => ({ days: [...h.days], opens: h.opens, closes: h.closes })) : d.hours.map((h) => ({ ...h, days: [...h.days] })),
    hoursDisplay: pick(saved.hoursDisplay, d.hoursDisplay),
    whatsappNote: pick(saved.whatsappNote, d.whatsappNote),
    social: saved.social && typeof saved.social === "object" ? social : { ...d.social },
    mapEmbed: pick(saved.mapEmbed, d.mapEmbed),
    mapLink: pick(saved.mapLink, d.mapLink),
    couriers: Array.isArray(saved.couriers) && saved.couriers.filter(nonEmpty).length ? saved.couriers.filter(nonEmpty).map((c) => c.trim()) : [...d.couriers],
  };
}

/** Primary phone (first in the list) – always defined (empty when the store hasn't added one). */
export function primaryPhone(info: SiteInfo): SitePhone {
  return info.phones[0] ?? { label: "", display: "", tel: "", wa: "" };
}

/** Where the store is, e.g. "Saddar, Karachi" (area and city from its address; "" when it has none). */
export function storePlace(info: SiteInfo, sep = ", ") {
  return [info.address.area, info.address.city].filter(nonEmpty).join(sep);
}

/** Non-empty social links in display order. */
export function socialLinks(info: SiteInfo) {
  return SOCIAL_NETWORKS.filter((n) => nonEmpty(info.social[n.key])).map((n) => ({ key: n.key, label: n.label, href: info.social[n.key]! }));
}
