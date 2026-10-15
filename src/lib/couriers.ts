/**
 * Courier partners (Pakistan's, and the big international ones) and their public tracking pages.
 * `track(cn)` returns a deep link where the courier supports one; otherwise the courier's tracking page.
 * Verify these URLs periodically – couriers occasionally change their tracking pages.
 */
export interface CourierInfo {
  name: string;
  website: string;
  track: (trackingNumber: string) => string;
}

const enc = encodeURIComponent;

export const COURIERS: Record<string, CourierInfo> = {
  tcs: {
    name: "TCS",
    website: "https://www.tcsexpress.com",
    track: (n) => `https://www.tcsexpress.com/track/${enc(n)}`,
  },
  leopards: {
    name: "Leopards Courier",
    website: "https://www.leopardscourier.com",
    track: (n) => `https://www.leopardscourier.com/leopards-tracking?cn=${enc(n)}`,
  },
  "m&p": {
    name: "M&P (Muller & Phipps)",
    website: "https://www.mulphilog.com",
    track: (n) => `https://www.mulphilog.com/tracking/${enc(n)}`,
  },
  trax: {
    name: "Trax",
    website: "https://trax.pk",
    track: (n) => `https://trax.pk/tracking/?tracking_number=${enc(n)}`,
  },
  postex: {
    name: "PostEx",
    website: "https://postex.pk",
    track: (n) => `https://postex.pk/tracking?cn=${enc(n)}`,
  },
  "call courier": {
    name: "Call Courier",
    website: "https://callcourier.com.pk",
    track: (n) => `https://callcourier.com.pk/tracking/?tc=${enc(n)}`,
  },
  // international
  dhl: {
    name: "DHL",
    website: "https://www.dhl.com",
    track: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${enc(n)}`,
  },
  fedex: {
    name: "FedEx",
    website: "https://www.fedex.com",
    track: (n) => `https://www.fedex.com/fedextrack/?trknbr=${enc(n)}`,
  },
  ups: {
    name: "UPS",
    website: "https://www.ups.com",
    track: (n) => `https://www.ups.com/track?tracknum=${enc(n)}`,
  },
  usps: {
    name: "USPS",
    website: "https://www.usps.com",
    track: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc(n)}`,
  },
  aramex: {
    name: "Aramex",
    website: "https://www.aramex.com",
    track: (n) => `https://www.aramex.com/track/results?ShipmentNumber=${enc(n)}`,
  },
  "royal mail": {
    name: "Royal Mail",
    website: "https://www.royalmail.com",
    track: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${enc(n)}`,
  },
};

const ALIASES: Record<string, string> = {
  "tcs express": "tcs",
  leopard: "leopards",
  "leopards courier": "leopards",
  mnp: "m&p",
  "m & p": "m&p",
  "m and p": "m&p",
  "muller & phipps": "m&p",
  "trax logistics": "trax",
  "post ex": "postex",
  callcourier: "call courier",
  "dhl express": "dhl",
  "fed ex": "fedex",
  royalmail: "royal mail",
};

export function courierInfo(courier?: string | null): CourierInfo | null {
  if (!courier) return null;
  const k = courier.trim().toLowerCase();
  return COURIERS[k] ?? COURIERS[ALIASES[k] ?? ""] ?? null;
}

/** Deep tracking link for a courier + consignment number, or null when the courier is unknown. */
export function courierTrackingUrl(courier?: string | null, trackingNumber?: string | null): string | null {
  const info = courierInfo(courier);
  if (!info) return null;
  return trackingNumber ? info.track(trackingNumber.trim()) : info.website;
}
