import { deliveryCharge, deliveryEstimate, deliveryZone, freeDeliveryAbove } from "./cities";
import type { StoreSettings } from "./types";
import { formatPKR } from "./utils";
import type { FaqItem } from "./types";

/**
 * Per-city local context for the /laptops-in-{city} landing pages. Copy is templated but varied by
 * delivery zone, city size and nearby areas so each page reads naturally and is not duplicate content.
 */
interface CityInfo {
  province: string;
  /** Neighbourhoods / nearby towns we commonly deliver to */
  areas: string[];
  /** Short local angle used in the intro */
  angle: string;
  size: "metro" | "large" | "medium";
}

export const CITY_INFO: Record<string, CityInfo> = {
  Karachi: { province: "Sindh", size: "metro", areas: ["DHA", "Clifton", "Gulshan-e-Iqbal", "North Nazimabad", "PECHS", "Korangi", "Malir", "Saddar"], angle: "our own shop is right here in Saddar" },
  Lahore: { province: "Punjab", size: "metro", areas: ["DHA", "Gulberg", "Johar Town", "Model Town", "Bahria Town", "Iqbal Town", "Wapda Town"], angle: "students, software houses and freelancers order from us every day" },
  Islamabad: { province: "Islamabad Capital Territory", size: "large", areas: ["F-6", "F-10", "G-11", "I-8", "E-11", "Bahria Enclave", "DHA Islamabad"], angle: "government offices, embassies and tech startups trust our business laptops" },
  Rawalpindi: { province: "Punjab", size: "large", areas: ["Saddar", "Satellite Town", "Bahria Town", "Chaklala", "Westridge", "Gulraiz"], angle: "it's one of our busiest delivery routes in the north" },
  Faisalabad: { province: "Punjab", size: "large", areas: ["D Ground", "Madina Town", "Peoples Colony", "Susan Road", "Jinnah Colony", "Samanabad"], angle: "textile businesses and university students rely on reliable office laptops" },
  Multan: { province: "Punjab", size: "large", areas: ["Cantt", "Gulgasht Colony", "Bosan Road", "Shah Rukn-e-Alam Colony", "New Multan"], angle: "we deliver across South Punjab from Multan to nearby towns" },
  Peshawar: { province: "Khyber Pakhtunkhwa", size: "large", areas: ["Hayatabad", "University Town", "Saddar", "Gulbahar", "Board Bazaar", "Warsak Road"], angle: "gamers and students in KP order gaming laptops and accessories from us" },
  Quetta: { province: "Balochistan", size: "large", areas: ["Jinnah Road", "Satellite Town", "Samungli Road", "Cantt", "Brewery Road"], angle: "we deliver securely to Balochistan's capital with Cash on Delivery" },
  Hyderabad: { province: "Sindh", size: "large", areas: ["Latifabad", "Qasimabad", "Saddar", "Hirabad", "Jamshoro", "Kotri"], angle: "it's just a short drive from our Karachi store, so parcels arrive fast" },
  Sialkot: { province: "Punjab", size: "medium", areas: ["Cantt", "Paris Road", "Kashmir Road", "Daska", "Sambrial", "Pasrur"], angle: "exporters and freelancers need dependable laptops for international clients" },
  Gujranwala: { province: "Punjab", size: "medium", areas: ["Satellite Town", "Model Town", "DC Colony", "Wapda Town", "Kamoke", "Wazirabad"], angle: "small businesses and students order budget and business laptops from us" },
  Sukkur: { province: "Sindh", size: "medium", areas: ["Military Road", "Barrage Colony", "New Sukkur", "Rohri", "Shikarpur", "Khairpur"], angle: "we serve upper Sindh with fast courier delivery from Karachi" },
  Bahawalpur: { province: "Punjab", size: "medium", areas: ["Model Town", "Satellite Town", "Cantt", "Ahmadpur East", "Hasilpur", "Lodhran"], angle: "university students make up many of our Bahawalpur customers" },
  Sargodha: { province: "Punjab", size: "medium", areas: ["Satellite Town", "University Road", "Cantt", "Bhalwal", "Kot Momin", "Shahpur"], angle: "we deliver budget and student laptops across the Sargodha division" },
  Abbottabad: { province: "Khyber Pakhtunkhwa", size: "medium", areas: ["Supply", "Jinnahabad", "Mandian", "Havelian", "Nathia Gali", "Mansehra"], angle: "students and professionals in Hazara order from us with Cash on Delivery" },
  Larkana: { province: "Sindh", size: "medium", areas: ["Station Road", "Sachal Colony", "Ratodero", "Kamber", "Shahdadkot", "Naudero"], angle: "we bring Karachi laptop prices to Larkana and nearby towns" },
  Mardan: { province: "Khyber Pakhtunkhwa", size: "medium", areas: ["Shamsi Road", "Sheikh Maltoon Town", "Takht Bhai", "Katlang", "Swabi", "Charsadda"], angle: "students in Mardan and nearby districts buy affordable laptops from us" },
  Sahiwal: { province: "Punjab", size: "medium", areas: ["Farid Town", "Civil Lines", "Chichawatni", "Arifwala", "Okara", "Pakpattan"], angle: "we deliver across Sahiwal division with tracked couriers" },
};

export function cityInfo(city: string): CityInfo {
  return CITY_INFO[city] ?? { province: "Pakistan", size: "medium", areas: [], angle: "we deliver with Cash on Delivery" };
}

export function cityIntro(city: string, settings?: StoreSettings) {
  const info = cityInfo(city);
  const est = deliveryEstimate(city, settings);
  const zone = deliveryZone(city);
  if (zone === "karachi") {
    return `Looking for a reliable laptop shop in Karachi? Urko Tech Store is based at Regal Trade Square, Regal Chowk – the heart of the Saddar laptop market – so ${info.angle}. Order online for same-day or next-day delivery anywhere in Karachi, or visit to check new, used and refurbished laptops in person.`;
  }
  const lead =
    info.size === "metro"
      ? `${city} is one of our biggest markets outside Karachi – ${info.angle}.`
      : info.size === "large"
        ? `From ${info.areas.slice(0, 2).join(" to ")}, ${info.angle}.`
        : `In ${city}, ${info.angle}.`;
  return `${lead} Buy new, used and refurbished laptops online from our Saddar, Karachi store and get them delivered to ${city} in ${est.label.toLowerCase()} – with Cash on Delivery, checked & tested quality and warranty.`;
}

/**
 * City page FAQs (also sent to Google as FAQ data). Delivery charge, free-delivery amount, delivery time and the
 * advance rule all come from /cms → Delivery & payments, the same rules checkout uses.
 */
export function cityFaqs(city: string, settings: StoreSettings): FaqItem[] {
  const est = deliveryEstimate(city, settings);
  const karachi = deliveryZone(city) === "karachi";
  const charge = deliveryCharge(city, 0, settings);
  const freeAbove = freeDeliveryAbove(city, settings);
  const advanceAbove = settings.advanceAmount > 0 && settings.advanceThreshold > 0 ? settings.advanceThreshold : 0;
  return [
    {
      q: `How long does laptop delivery take to ${city}?`,
      a: karachi
        ? "Karachi orders confirmed before 5 PM are usually delivered the same day or next day, depending on your area."
        : `Delivery to ${city} usually takes ${est.label.toLowerCase()} after your order is confirmed. You receive a tracking number on WhatsApp as soon as it's dispatched.`,
    },
    {
      q: `Is Cash on Delivery available in ${city}?`,
      a: `Yes. You can pay cash to the courier rider when your laptop arrives in ${city}.${advanceAbove ? ` For orders above ${formatPKR(advanceAbove)} we ask for an advance of ${formatPKR(settings.advanceAmount)} via JazzCash, EasyPaisa or bank transfer to confirm the order.` : ""}`,
    },
    {
      q: `What are the delivery charges to ${city}?`,
      a:
        charge <= 0
          ? `Delivery to ${city} is free.`
          : freeAbove > 0
            ? `Delivery to ${city} costs ${formatPKR(charge)} on orders below ${formatPKR(freeAbove)}. Orders of ${formatPKR(freeAbove)} or more are delivered free.`
            : `Delivery to ${city} costs ${formatPKR(charge)}. The exact charge is shown at checkout.`,
    },
    {
      q: `Can I check the laptop before paying in ${city}?`,
      a: karachi
        ? "Yes – visit our shop at Regal Trade Square, Regal Chowk, Saddar to check any laptop in person, or open the parcel in front of the rider for visible damage before paying."
        : `Every laptop is checked & tested on 30+ points before dispatch and the exact condition and battery health are listed on the product page. Please check the parcel for visible damage when it arrives and report any issue within 3 days for a free replacement.`,
    },
    {
      q: `Do used laptops delivered to ${city} come with warranty?`,
      a: "Yes. Used laptops include a 1–3 month checking warranty, refurbished laptops up to 6 months, and new laptops carry official brand warranty.",
    },
  ];
}
