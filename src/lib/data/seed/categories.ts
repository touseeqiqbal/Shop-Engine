import type { Category, CategoryAttribute } from "@/lib/types";

/*
 * Seed category tree. In production these rows live in the Supabase `categories` table and are
 * fully editable in /cms → Catalog → Categories – new categories need no code changes.
 * Brand, price, condition and stock filters are built in for every category; `attributes` adds
 * category-specific filters on top.
 */

const laptopAttrs: CategoryAttribute[] = [
  { key: "processor", label: "Processor", kind: "select" },
  { key: "generation", label: "Generation", kind: "select" },
  { key: "ram", label: "RAM", kind: "select" },
  { key: "storage", label: "Storage", kind: "select" },
  { key: "gpu", label: "Graphics", kind: "select" },
  { key: "screenSize", label: "Screen Size", kind: "select" },
  { key: "touch", label: "Touchscreen", kind: "boolean" },
];
const mouseAttrs: CategoryAttribute[] = [
  { key: "connectivity", label: "Connectivity", kind: "select", options: ["Wired", "Wireless", "Bluetooth"] },
  { key: "usage", label: "Use", kind: "select", options: ["Gaming", "Office"] },
  { key: "rgb", label: "RGB Lighting", kind: "boolean" },
  { key: "dpi", label: "Max DPI", kind: "range" },
];
const keyboardAttrs: CategoryAttribute[] = [
  { key: "connectivity", label: "Connectivity", kind: "select", options: ["Wired", "Wireless", "Bluetooth"] },
  { key: "usage", label: "Use", kind: "select", options: ["Gaming", "Office", "Laptop Replacement"] },
  { key: "switchType", label: "Switches", kind: "select" },
  { key: "layout", label: "Layout", kind: "select" },
  { key: "rgb", label: "RGB Lighting", kind: "boolean" },
];
const chargerAttrs: CategoryAttribute[] = [
  { key: "compatibleBrand", label: "Compatible Brand", kind: "select" },
  { key: "wattage", label: "Wattage", kind: "select" },
  { key: "connector", label: "Connector", kind: "select" },
];
const batteryAttrs: CategoryAttribute[] = [
  { key: "compatibleBrand", label: "Compatible Brand", kind: "select" },
  { key: "cells", label: "Cells", kind: "select" },
  { key: "capacity", label: "Capacity (mAh)", kind: "range", unit: "mAh" },
];
const storageAttrs: CategoryAttribute[] = [
  { key: "capacity", label: "Capacity", kind: "select" },
  { key: "type", label: "Type", kind: "select" },
  { key: "interface", label: "Interface", kind: "select" },
  { key: "readSpeed", label: "Read Speed (MB/s)", kind: "range", unit: "MB/s" },
];
const ramAttrs: CategoryAttribute[] = [
  { key: "capacity", label: "Capacity", kind: "select" },
  { key: "type", label: "Type", kind: "select", options: ["DDR3", "DDR4", "DDR5"] },
  { key: "formFactor", label: "Form Factor", kind: "select", options: ["Laptop (SO-DIMM)", "Desktop (DIMM)"] },
  { key: "speed", label: "Speed (MHz)", kind: "select" },
];
const audioAttrs: CategoryAttribute[] = [
  { key: "connectivity", label: "Connectivity", kind: "select" },
  { key: "type", label: "Type", kind: "select" },
  { key: "mic", label: "Microphone", kind: "boolean" },
  { key: "anc", label: "Noise Cancelling", kind: "boolean" },
];
const accessoryAttrs: CategoryAttribute[] = [
  { key: "fitsSize", label: "Fits Laptop Size", kind: "select" },
  { key: "material", label: "Material", kind: "select" },
];
const cableAttrs: CategoryAttribute[] = [
  { key: "ports", label: "Ports", kind: "select" },
  { key: "connector", label: "Connector", kind: "select" },
  { key: "length", label: "Length", kind: "select" },
];
const networkAttrs: CategoryAttribute[] = [
  { key: "wifiStandard", label: "Wi-Fi Standard", kind: "select" },
  { key: "speed", label: "Speed", kind: "select" },
  { key: "band", label: "Band", kind: "select" },
];
const monitorAttrs: CategoryAttribute[] = [
  { key: "screenSize", label: "Screen Size", kind: "select" },
  { key: "resolution", label: "Resolution", kind: "select" },
  { key: "refreshRate", label: "Refresh Rate", kind: "select" },
  { key: "panel", label: "Panel", kind: "select" },
];
const wholesaleAttrs: CategoryAttribute[] = [
  { key: "lotSize", label: "Units in Lot", kind: "range", unit: "pcs" },
  { key: "grade", label: "Grade", kind: "select", options: ["Grade A", "Grade A/B", "Grade B", "New"] },
  { key: "brandMix", label: "Brands", kind: "select" },
  { key: "processor", label: "Processor", kind: "select" },
];
const webcamAttrs: CategoryAttribute[] = [
  { key: "resolution", label: "Resolution", kind: "select" },
  { key: "mic", label: "Microphone", kind: "boolean" },
];

let order = 0;
function top(
  slug: string,
  name: string,
  icon: string,
  shortDescription: string,
  attributes: CategoryAttribute[],
  extra: Partial<Category> = {}
): Category {
  return {
    id: `cat-${slug}`,
    slug,
    name,
    parentId: null,
    icon,
    shortDescription,
    attributes,
    sortOrder: order++,
    featured: true,
    ...extra,
  };
}
function sub(parent: string, slug: string, name: string, shortDescription: string, extra: Partial<Category> = {}): Category {
  return {
    id: `cat-${slug}`,
    slug,
    name,
    parentId: `cat-${parent}`,
    icon: "",
    shortDescription,
    attributes: [],
    sortOrder: order++,
    ...extra,
  };
}

export const seedCategories: Category[] = [
  top("laptops", "Laptops", "Laptop", "New, used & refurbished laptops from HP, Dell, Lenovo, Apple, Asus and more.", laptopAttrs, {
    nameUr: "لیپ ٹاپ",
    seoTitle: "Laptops Price in Pakistan 2026 – New, Used & Refurbished | Urko Tech Store",
    seoDescription:
      "Buy new, used and refurbished laptops in Karachi & all over Pakistan. HP EliteBook, Dell Latitude, Lenovo ThinkPad, MacBook & gaming laptops with warranty and Cash on Delivery.",
    seoContent: `## Laptop shop in Karachi with delivery all over Pakistan

Urko Tech Store is a trusted **laptop shop in Saddar, Karachi** located at Regal Trade Square, Regal Chowk – the heart of Karachi's laptop market. We stock brand new laptops, premium **used laptops in Karachi** graded A+ and A, and fully refurbished business machines like the HP EliteBook, Dell Latitude and Lenovo ThinkPad.

Every used and refurbished laptop is checked & tested on 30+ points – battery health, keyboard, display, ports, Wi-Fi, webcam and thermals – before it is listed. You get the exact condition notes on every product page, so you know what you are buying.

### Laptop price in Pakistan
Prices change with the dollar rate, so we update our **laptop prices in Pakistan** daily. Use the filters to sort by processor (Core i5, Core i7, Ryzen), generation, RAM and storage, or choose a budget laptop under Rs 100,000.

### Buy laptop online in Pakistan with Cash on Delivery
Order online and pay on delivery. Karachi orders are delivered same or next day, and we ship to Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta and every other city within 1–5 working days.`,
    compatibility: false,
  }),
  sub("laptops", "gaming-laptops", "Gaming Laptops", "RTX-powered gaming laptops for high FPS gaming and creators."),
  sub("laptops", "business-laptops", "Business Laptops", "Durable EliteBook, Latitude & ThinkPad machines for professionals."),
  sub("laptops", "student-laptops", "Student Laptops", "Light, reliable and affordable laptops for students."),
  sub("laptops", "macbooks", "MacBooks", "Apple MacBook Air & MacBook Pro with M-series chips."),
  sub("laptops", "2-in-1-laptops", "2-in-1 Laptops", "Touchscreen convertibles that flip into a tablet."),
  sub("laptops", "budget-laptops", "Budget Laptops (Under Rs 100,000)", "Best value laptops under Rs 100,000 in Pakistan."),
  sub("laptops", "used-refurbished-laptops", "Used / Refurbished Laptops", "Checked & tested used and refurbished laptops with warranty."),

  top("mouse", "Mouse", "Mouse", "Wired, wireless and gaming mouse from Logitech, Razer, Redragon & A4Tech.", mouseAttrs, {
    nameUr: "ماؤس",
    seoTitle: "Mouse Price in Pakistan – Wireless & Gaming Mouse | Urko Tech Store",
    seoDescription:
      "Shop wireless, wired and gaming mouse at the best price in Pakistan. Logitech, Razer, Redragon, A4Tech with Cash on Delivery nationwide.",
    seoContent: `## Gaming mouse price in Pakistan
From the everyday Logitech M185 wireless mouse to RGB **gaming mouse** options from Redragon and Razer, we stock genuine products at the best **gaming mouse price in Pakistan**. Filter by connectivity, DPI and RGB lighting to find the right one.`,
  }),
  sub("mouse", "wired-mouse", "Wired Mouse", "Plug-and-play wired mouse for office and home."),
  sub("mouse", "wireless-mouse", "Wireless Mouse", "Cable-free 2.4GHz & Bluetooth mouse."),
  sub("mouse", "gaming-mouse", "Gaming Mouse", "High DPI, low latency gaming mouse with RGB."),

  top("keyboards", "Keyboards", "Keyboard", "Mechanical, wireless, gaming and laptop replacement keyboards.", keyboardAttrs, {
    nameUr: "کی بورڈ",
    compatibility: true,
    seoTitle: "Keyboards in Pakistan – Mechanical & Laptop Keyboards | Urko Tech Store",
    seoDescription:
      "Buy mechanical gaming keyboards, wireless keyboards and laptop replacement keyboards in Pakistan. Redragon, Logitech, HP, Dell, Lenovo keyboards with COD.",
    seoContent: `## Mechanical keyboard Pakistan
Looking for a **mechanical keyboard in Pakistan**? Choose from Redragon, Logitech and more with red, blue and brown switches. Need a **laptop replacement keyboard**? Use the "Find Parts for Your Laptop" tool to see keyboards that fit your exact model.`,
  }),
  sub("keyboards", "mechanical-keyboards", "Mechanical Keyboards", "Tactile mechanical keyboards for typing and gaming."),
  sub("keyboards", "wireless-keyboards", "Wireless Keyboards", "Clutter-free wireless & Bluetooth keyboards."),
  sub("keyboards", "gaming-keyboards", "Gaming Keyboards", "RGB gaming keyboards with anti-ghosting."),
  sub("keyboards", "laptop-replacement-keyboards", "Laptop Replacement Keyboards", "Original & compatible replacement keyboards for laptops.", { compatibility: true }),

  top("chargers", "Chargers & Adapters", "PlugZap", "Laptop chargers by brand, USB-C PD chargers and universal adapters.", chargerAttrs, {
    nameUr: "چارجر",
    compatibility: true,
    seoTitle: "Laptop Charger Price in Pakistan – HP, Dell, Lenovo, Type-C | Urko Tech Store",
    seoDescription:
      "Original & high-quality laptop chargers for HP, Dell, Lenovo, Asus, Acer and Apple. Type-C PD chargers and universal adapters with warranty. Delivery all over Pakistan.",
    seoContent: `## Laptop charger price in Pakistan
A wrong charger can damage your laptop. Use our compatibility finder to pick the right **laptop charger** by brand, wattage and pin size – or choose a USB-C PD charger for modern laptops. We list the exact **laptop charger price in Pakistan** with warranty on every adapter.`,
  }),
  sub("chargers", "laptop-chargers", "Laptop Chargers (by brand)", "Brand-specific laptop chargers with the right pin size.", { compatibility: true }),
  sub("chargers", "type-c-chargers", "Type-C / USB-C PD Chargers", "Fast USB-C Power Delivery chargers for laptops & phones.", { compatibility: true }),
  sub("chargers", "universal-adapters", "Universal Adapters", "Multi-tip universal laptop adapters."),

  top("batteries", "Laptop Batteries", "BatteryCharging", "Replacement laptop batteries by brand and model.", batteryAttrs, {
    nameUr: "بیٹری",
    compatibility: true,
    seoTitle: "Laptop Battery Price in Karachi & Pakistan | Urko Tech Store",
    seoDescription:
      "Replacement laptop batteries for HP, Dell, Lenovo and more. Find the right battery for your laptop model. Warranty and Cash on Delivery all over Pakistan.",
    seoContent: `## Laptop battery Karachi
Is your laptop shutting down unexpectedly? Get a new **laptop battery in Karachi** or anywhere in Pakistan. Select your laptop brand and model in the finder to see batteries guaranteed to fit.`,
  }),
  sub("batteries", "hp-batteries", "HP Batteries", "Replacement batteries for HP laptops.", { compatibility: true }),
  sub("batteries", "dell-batteries", "Dell Batteries", "Replacement batteries for Dell laptops.", { compatibility: true }),
  sub("batteries", "lenovo-batteries", "Lenovo Batteries", "Replacement batteries for Lenovo laptops.", { compatibility: true }),

  top("storage", "Storage", "HardDrive", "SSDs, hard drives, USB flash drives and memory cards.", storageAttrs, {
    nameUr: "اسٹوریج",
    seoTitle: "SSD Price in Pakistan – NVMe, SATA, HDD & USB | Urko Tech Store",
    seoDescription: "Buy NVMe & SATA SSDs, hard drives, USB flash drives and memory cards from Kingston, Samsung, WD and more at the best price in Pakistan.",
  }),
  sub("storage", "ssd", "SSDs (SATA / NVMe)", "Speed up any laptop with an SSD upgrade."),
  sub("storage", "hard-drives", "Hard Drives", "Internal & external hard drives."),
  sub("storage", "usb-flash-drives", "USB Flash Drives", "Portable USB 3.0 flash drives."),
  sub("storage", "memory-cards", "Memory Cards", "microSD & SD cards for phones and cameras."),

  top("ram", "RAM", "MemoryStick", "DDR4 and DDR5 RAM for laptops and desktops.", ramAttrs, {
    nameUr: "ریم",
    compatibility: true,
    seoTitle: "Laptop RAM Price in Pakistan – DDR4 & DDR5 | Urko Tech Store",
    seoDescription: "Upgrade your laptop or PC with DDR4 & DDR5 RAM from Kingston, Crucial, Samsung. Find compatible RAM for your laptop model.",
  }),
  sub("ram", "ddr4-ram", "DDR4 RAM", "DDR4 memory for laptops & desktops.", { compatibility: true }),
  sub("ram", "ddr5-ram", "DDR5 RAM", "Next-gen DDR5 memory.", { compatibility: true }),

  top("audio", "Audio", "Headphones", "Headphones, gaming headsets, earbuds and speakers.", audioAttrs, {
    nameUr: "آڈیو",
    seoTitle: "Headphones, Earbuds & Gaming Headsets in Pakistan | Urko Tech Store",
    seoDescription: "Shop headphones, gaming headsets, wireless earbuds and Bluetooth speakers with delivery all over Pakistan.",
  }),
  sub("audio", "headphones", "Headphones", "Over-ear & on-ear headphones."),
  sub("audio", "gaming-headsets", "Gaming Headsets", "Surround sound headsets with mic."),
  sub("audio", "earbuds", "Earbuds", "True wireless earbuds."),
  sub("audio", "speakers", "Speakers", "Bluetooth & desktop speakers."),

  top("laptop-accessories", "Laptop Accessories", "Briefcase", "Bags, cooling pads, stands, screen protectors and skins.", accessoryAttrs, {
    nameUr: "لیپ ٹاپ لوازمات",
    seoTitle: "Laptop Accessories in Pakistan – Bags, Cooling Pads, Stands | Urko Tech Store",
    seoDescription: "Laptop bags, sleeves, cooling pads, stands, screen protectors and skins at great prices with nationwide delivery.",
  }),
  sub("laptop-accessories", "bags-sleeves", "Bags & Sleeves", "Backpacks, messenger bags and sleeves."),
  sub("laptop-accessories", "cooling-pads", "Cooling Pads", "Keep your laptop cool under load."),
  sub("laptop-accessories", "laptop-stands", "Laptop Stands", "Ergonomic aluminium stands."),
  sub("laptop-accessories", "screen-protectors", "Screen Protectors", "Anti-glare & privacy screen filters."),
  sub("laptop-accessories", "laptop-skins", "Skins", "Custom vinyl skins for laptops."),

  top("cables-hubs", "Cables & Hubs", "Cable", "USB hubs, Type-C docks, HDMI cables and adapters.", cableAttrs, {
    nameUr: "کیبلز",
    seoTitle: "USB-C Hubs, Docks & HDMI Cables in Pakistan | Urko Tech Store",
    seoDescription: "USB hubs, USB-C docks, HDMI cables and adapters for laptops and MacBooks with delivery all over Pakistan.",
  }),
  sub("cables-hubs", "usb-hubs", "USB Hubs", "Expand your USB ports."),
  sub("cables-hubs", "type-c-docks", "Type-C Docks", "Multi-port USB-C docking stations."),
  sub("cables-hubs", "hdmi-cables", "HDMI Cables", "4K HDMI cables in all lengths."),
  sub("cables-hubs", "adapters", "Adapters", "USB-C to HDMI, VGA, Ethernet and more."),

  top("networking", "Networking", "Wifi", "Wi-Fi routers and USB/PCIe Wi-Fi adapters.", networkAttrs, {
    nameUr: "نیٹ ورکنگ",
    seoTitle: "Wi-Fi Routers & Adapters Price in Pakistan | Urko Tech Store",
    seoDescription: "TP-Link and Tenda routers and Wi-Fi adapters at the best price in Pakistan.",
  }),
  sub("networking", "routers", "Routers", "Dual-band and mesh Wi-Fi routers."),
  sub("networking", "wifi-adapters", "Wi-Fi Adapters", "USB & PCIe wireless adapters."),

  top("monitors", "Monitors", "Monitor", "Office and gaming monitors.", monitorAttrs, {
    nameUr: "مانیٹر",
    seoTitle: "LED Monitors & Gaming Monitors Price in Pakistan | Urko Tech Store",
    seoDescription: "Buy 22\", 24\" and 27\" office and high refresh gaming monitors in Pakistan with warranty.",
  }),
  top("webcams", "Webcams", "Webcam", "HD webcams for meetings, classes and streaming.", webcamAttrs, {
    nameUr: "ویب کیم",
    seoTitle: "Webcams Price in Pakistan – 1080p HD | Urko Tech Store",
    seoDescription: "1080p and 2K webcams for online classes, meetings and streaming. Delivery all over Pakistan.",
  }),
  top("wholesale-lots", "Wholesale Lots", "Package", "Bulk used laptops & accessory lots for shops, resellers and offices – price on request.", wholesaleAttrs, {
    nameUr: "ہول سیل",
    featured: false,
    seoTitle: "Wholesale Used Laptops Pakistan – Bulk Laptop Lots Karachi | Urko Tech Store",
    seoDescription:
      "Wholesale used laptops in Pakistan: bulk HP, Dell & Lenovo laptop lots, mixed pallets and accessories in bulk from Saddar, Karachi. Checked & tested, graded A/B. Request a quote.",
    seoContent: `## Wholesale used laptops in Pakistan

Urko Tech Store supplies **bulk laptops in Karachi** and all over Pakistan to computer shops, resellers, offices, schools and institutes. Every lot is sourced, checked and tested at our shop in the **Saddar laptop market** (Regal Trade Square, Regal Chowk) before it is packed and shipped.

### Used laptop lots & pallets
Buy **used laptop lots** of a single model (for example 20× HP EliteBook 840 G5) or **mixed lots** of Dell, HP and Lenovo business laptops sorted by processor and generation. Each lot lists its grade (A, A/B or B), the exact contents and what's included, so you know what you are getting.

### Laptop wholesale in Saddar, Karachi – price on request
Wholesale rates depend on quantity, grade and the current dollar rate, so we quote every order individually. Send a [wholesale quote request](/wholesale#quote) or message us on WhatsApp – we usually reply within store hours with prices, photos and videos of the stock.

### Accessories in bulk
Chargers, batteries, mouse, keyboards, SSDs and RAM are also available in bulk for repair shops and resellers – look for the **"Request bulk quote"** button on any product.`,
  }),
];
