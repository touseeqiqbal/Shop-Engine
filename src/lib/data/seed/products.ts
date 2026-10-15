import type { Product, SpecRow, UpgradeOption } from "@/lib/types";
import { DEFAULT_LOCALE } from "@/lib/locale";
import { addDays, dayIn, dayStart } from "@/lib/time";

/*
 * Seed catalog. Images are generated placeholders in /public/images/products (run `npm run images`);
 * replace them with real product photos from the admin panel (uploaded to Supabase Storage).
 */

const DAY = 864e5;
const BASE = Date.UTC(2026, 8, 1); // 1 Sep 2026
const created = (daysAgo: number) => new Date(BASE - daysAgo * DAY).toISOString();

/** Rolling weekly deal end: next Sunday 23:59 in the default store's time zone (Asia/Karachi). */
function nextSundayLocal(timezone = DEFAULT_LOCALE.timezone) {
  const today = dayIn(Date.now(), timezone);
  const daysToSunday = (7 - new Date(`${today}T12:00:00Z`).getUTCDay()) % 7 || 7;
  // 23:59 on that Sunday = one minute before the next local midnight (right on DST days too)
  const end = dayStart(addDays(today, daysToSunday + 1), timezone) - 60e3;
  return new Date(end).toISOString();
}
export const SEED_DEAL_END = nextSundayLocal();

const img = (slug: string, n = 2) => Array.from({ length: n }, (_, i) => `/images/products/${slug}-${i + 1}.svg`);

const ramUpgrades = (base: number): UpgradeOption[] =>
  [
    base < 16 && { id: "ram-16", group: "RAM", label: "Upgrade to 16GB RAM", price: 9000 },
    base < 32 && { id: "ram-32", group: "RAM", label: "Upgrade to 32GB RAM", price: 22000 },
  ].filter(Boolean) as UpgradeOption[];

const ssdUpgrades = (baseGb: number): UpgradeOption[] =>
  [
    baseGb < 512 && { id: "ssd-512", group: "SSD", label: "Upgrade to 512GB NVMe SSD", price: 8000 },
    baseGb < 1024 && { id: "ssd-1tb", group: "SSD", label: "Upgrade to 1TB NVMe SSD", price: 18000 },
  ].filter(Boolean) as UpgradeOption[];

type Base = Omit<
  Product,
  "images" | "status" | "rating" | "reviewCount" | "soldCount" | "tags" | "upgrades" | "boughtTogether" | "compatibility" | "attributes" | "specs" | "description"
> &
  Partial<Product>;

function make(p: Base): Product {
  return {
    images: img(p.slug),
    status: "active",
    rating: 4.7,
    reviewCount: 0,
    soldCount: 0,
    tags: [],
    upgrades: [],
    boughtTogether: [],
    compatibility: [],
    attributes: {},
    specs: [],
    description: p.shortDescription,
    ...p,
  };
}

interface LaptopInput {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  price: number;
  salePrice?: number;
  condition: Product["condition"];
  conditionNotes?: string;
  processor: string;
  cpuFull: string;
  generation: string;
  ramGb: number;
  storageGb: number;
  gpu: string;
  screen: string;
  screenSize: string;
  touch?: boolean;
  os: string;
  battery?: string;
  weight: string;
  ports: string;
  warranty: string;
  stock: number;
  short: string;
  body: string;
  extra?: Partial<Product>;
}

function laptop(l: LaptopInput): Product {
  const specs: SpecRow[] = [
    { label: "Processor", value: l.cpuFull },
    { label: "Generation", value: l.generation },
    { label: "RAM", value: `${l.ramGb}GB` },
    { label: "Storage", value: l.storageGb >= 1024 ? `${l.storageGb / 1024}TB SSD` : `${l.storageGb}GB SSD` },
    { label: "Graphics", value: l.gpu },
    { label: "Display", value: l.screen },
    { label: "Operating System", value: l.os },
    { label: "Ports", value: l.ports },
    { label: "Weight", value: l.weight },
  ];
  if (l.battery) specs.push({ label: "Battery", value: l.battery });
  return make({
    id: l.id,
    slug: l.slug,
    name: l.name,
    brand: l.brand,
    categoryId: l.categoryId,
    sku: l.id.toUpperCase(),
    shortDescription: l.short,
    description: l.body,
    price: l.price,
    salePrice: l.salePrice ?? null,
    stock: l.stock,
    condition: l.condition,
    conditionNotes: l.conditionNotes,
    warranty: l.warranty,
    specs,
    attributes: {
      processor: l.processor,
      generation: l.generation,
      ram: `${l.ramGb}GB`,
      storage: l.storageGb >= 1024 ? `${l.storageGb / 1024}TB` : `${l.storageGb}GB`,
      gpu: l.gpu.includes("RTX") || l.gpu.includes("GTX") ? "Dedicated (NVIDIA)" : "Integrated",
      screenSize: l.screenSize,
      touch: !!l.touch,
    },
    upgrades: l.brand === "apple" ? [] : [...ramUpgrades(l.ramGb), ...ssdUpgrades(l.storageGb)],
    boughtTogether: ["p-logitech-m185", "p-laptop-backpack-156", "p-cooling-pad-5-fans"],
    bundleDiscountPercent: 5,
    createdAt: created(10),
    ...l.extra,
  });
}

export const seedProducts: Product[] = [
  // ───────────────────────── Laptops ─────────────────────────
  laptop({
    id: "p-hp-elitebook-840-g8",
    slug: "hp-elitebook-840-g8-core-i5-11th-gen",
    name: "HP EliteBook 840 G8 – Core i5 11th Gen, 16GB, 256GB SSD",
    brand: "hp",
    categoryId: "cat-business-laptops",
    price: 125000,
    salePrice: 115000,
    condition: "used-a-plus",
    conditionNotes: "Battery health 91%. No scratches or dents. Original HP charger included. Backlit keyboard works perfectly.",
    processor: "Intel Core i5",
    cpuFull: "Intel Core i5-1135G7 (up to 4.2GHz, 4 cores / 8 threads)",
    generation: "11th Gen",
    ramGb: 16,
    storageGb: 256,
    gpu: "Intel Iris Xe Graphics",
    screen: '14" Full HD (1920×1080) IPS anti-glare',
    screenSize: '14"',
    os: "Windows 11 Pro",
    battery: "3-cell 53Wh – up to 8 hours",
    weight: "1.32 kg",
    ports: "2× Thunderbolt 4 (USB-C), 2× USB-A, HDMI 2.0, audio jack",
    warranty: "3 months checking warranty",
    stock: 6,
    short: "Premium aluminium business laptop with 11th Gen Core i5, 16GB RAM and a sharp Full HD screen – Used A+ condition.",
    body: `The **HP EliteBook 840 G8** is one of the most popular business laptops in Pakistan – slim aluminium build, excellent keyboard and strong battery life.

### Why buy this EliteBook
- 11th Gen Intel Core i5 with Iris Xe graphics – smooth for office work, coding and light editing
- 16GB RAM for heavy multitasking
- Thunderbolt 4 for docks and external monitors
- Military-grade (MIL-STD 810H) durability

### Condition
Graded **Used A+** – looks almost new. Fully checked & tested by our technicians in Saddar, Karachi.`,
    extra: { wholesale: { available: true, minQty: 5 }, featured: true, bestSeller: true, hotDeal: true, dealEndsAt: SEED_DEAL_END, rating: 4.8, reviewCount: 3, soldCount: 142, tags: ["elitebook", "business", "used laptop karachi"], createdAt: created(40) },
  }),
  laptop({
    id: "p-dell-latitude-5420",
    slug: "dell-latitude-5420-core-i7-11th-gen",
    name: "Dell Latitude 5420 – Core i7 11th Gen, 16GB, 512GB SSD",
    brand: "dell",
    categoryId: "cat-business-laptops",
    price: 125000,
    condition: "used-a",
    conditionNotes: "Battery health 84%. Light marks on the lid, screen and keyboard are flawless.",
    processor: "Intel Core i7",
    cpuFull: "Intel Core i7-1185G7 vPro (up to 4.8GHz)",
    generation: "11th Gen",
    ramGb: 16,
    storageGb: 512,
    gpu: "Intel Iris Xe Graphics",
    screen: '14" Full HD (1920×1080) IPS',
    screenSize: '14"',
    os: "Windows 11 Pro",
    battery: "4-cell 63Wh",
    weight: "1.4 kg",
    ports: "2× Thunderbolt 4, 2× USB-A, HDMI, RJ45 Ethernet, microSD",
    warranty: "3 months checking warranty",
    stock: 4,
    short: "Powerful Core i7 vPro business laptop with 512GB SSD and Ethernet port – Used A condition.",
    body: `The **Dell Latitude 5420** combines a Core i7 vPro processor with a durable chassis and a comfortable spill-resistant keyboard. A great choice for professionals and freelancers.

- Core i7-1185G7 – top-tier 11th Gen performance
- 512GB NVMe SSD for fast boot
- Full port selection including Ethernet and HDMI`,
    extra: { wholesale: { available: true, minQty: 5 }, featured: true, bestSeller: true, rating: 4.7, reviewCount: 2, soldCount: 98, tags: ["latitude", "core i7"], createdAt: created(30) },
  }),
  laptop({
    id: "p-lenovo-thinkpad-t14",
    slug: "lenovo-thinkpad-t14-ryzen-5-pro",
    name: "Lenovo ThinkPad T14 – Ryzen 5 Pro, 16GB, 512GB SSD",
    brand: "lenovo",
    categoryId: "cat-used-refurbished-laptops",
    price: 112000,
    salePrice: 105000,
    condition: "refurbished",
    conditionNotes: "Refurbished with new battery and fresh thermal paste. New keyboard. 6 months warranty.",
    processor: "AMD Ryzen 5",
    cpuFull: "AMD Ryzen 5 PRO 4650U (6 cores / 12 threads, up to 4.0GHz)",
    generation: "Ryzen 4000",
    ramGb: 16,
    storageGb: 512,
    gpu: "AMD Radeon Graphics",
    screen: '14" Full HD (1920×1080) IPS',
    screenSize: '14"',
    os: "Windows 11 Pro",
    battery: "New 50Wh battery",
    weight: "1.46 kg",
    ports: "2× USB-C, 2× USB-A, HDMI, RJ45, audio jack",
    warranty: "6 months warranty",
    stock: 5,
    short: "Legendary ThinkPad keyboard and 6-core Ryzen 5 Pro power – professionally refurbished with a new battery.",
    body: `The **Lenovo ThinkPad T14** is a workhorse loved by developers and business users. This unit has been **professionally refurbished** – new battery, new keyboard and full internal cleaning.

- 6-core Ryzen 5 PRO 4650U beats many Core i7 chips in multitasking
- 16GB RAM, 512GB SSD
- 6 months warranty from Urko Tech Store`,
    extra: { wholesale: { available: true, minQty: 5 }, featured: true, hotDeal: true, dealEndsAt: SEED_DEAL_END, rating: 4.6, reviewCount: 2, soldCount: 76, createdAt: created(25) },
  }),
  laptop({
    id: "p-macbook-air-m2",
    slug: "apple-macbook-air-m2-8gb-256gb",
    name: "Apple MacBook Air M2 – 8GB, 256GB",
    brand: "apple",
    categoryId: "cat-macbooks",
    price: 310000,
    condition: "new",
    processor: "Apple M2",
    cpuFull: "Apple M2 chip – 8-core CPU, 8-core GPU",
    generation: "M2",
    ramGb: 8,
    storageGb: 256,
    gpu: "Apple 8-core GPU",
    screen: '13.6" Liquid Retina (2560×1664), 500 nits',
    screenSize: '13.6"',
    os: "macOS",
    battery: "Up to 18 hours",
    weight: "1.24 kg",
    ports: "2× Thunderbolt / USB 4, MagSafe 3, headphone jack",
    warranty: "1 year international warranty",
    stock: 3,
    short: "Brand new, box-packed MacBook Air M2 – incredibly thin, silent and lasts all day.",
    body: `The **MacBook Air M2** is the best all-round laptop for students and creators. Fanless design, gorgeous Liquid Retina display and up to 18 hours battery life.

Box packed with **1 year warranty**. Available in Midnight, Starlight, Space Grey and Silver (subject to stock – confirm on WhatsApp).`,
    extra: { featured: true, bestSeller: true, rating: 4.9, reviewCount: 2, soldCount: 64, createdAt: created(12), boughtTogether: ["p-usb-c-hub-7in1", "p-laptop-backpack-156", "p-laptop-stand-aluminium"] },
  }),
  laptop({
    id: "p-asus-tuf-f15",
    slug: "asus-tuf-gaming-f15-core-i5-12th-gen-rtx-3050",
    name: "Asus TUF Gaming F15 – Core i5 12th Gen, RTX 3050, 16GB, 512GB",
    brand: "asus",
    categoryId: "cat-gaming-laptops",
    price: 235000,
    condition: "new",
    processor: "Intel Core i5",
    cpuFull: "Intel Core i5-12500H (12 cores, up to 4.5GHz)",
    generation: "12th Gen",
    ramGb: 16,
    storageGb: 512,
    gpu: "NVIDIA GeForce RTX 3050 4GB",
    screen: '15.6" Full HD 144Hz IPS',
    screenSize: '15.6"',
    os: "Windows 11 Home",
    weight: "2.2 kg",
    ports: "Thunderbolt 4, 3× USB-A, HDMI 2.0b, RJ45",
    warranty: "1 year official warranty",
    stock: 4,
    short: "144Hz gaming laptop with RTX 3050 and 12th Gen Core i5 – military-grade TUF durability.",
    body: `Play GTA V, Valorant, PUBG and Call of Duty at high FPS on the **Asus TUF Gaming F15**.

- 12th Gen Core i5-12500H with 12 cores
- NVIDIA RTX 3050 4GB with DLSS
- 144Hz Full HD display for smooth gameplay
- MIL-STD-810H tested build`,
    extra: { featured: true, rating: 4.8, reviewCount: 1, soldCount: 51, createdAt: created(5), boughtTogether: ["p-redragon-k552", "p-razer-deathadder-essential", "p-cooling-pad-5-fans"] },
  }),
  laptop({
    id: "p-hp-probook-450-g8",
    slug: "hp-probook-450-g8-core-i5-11th-gen",
    name: "HP ProBook 450 G8 – Core i5 11th Gen, 8GB, 256GB SSD",
    brand: "hp",
    categoryId: "cat-budget-laptops",
    price: 92000,
    salePrice: 87500,
    condition: "used-a",
    conditionNotes: "Battery health 80%. Minor wear on palm rest. Numeric keypad.",
    processor: "Intel Core i5",
    cpuFull: "Intel Core i5-1135G7",
    generation: "11th Gen",
    ramGb: 8,
    storageGb: 256,
    gpu: "Intel Iris Xe Graphics",
    screen: '15.6" Full HD IPS',
    screenSize: '15.6"',
    os: "Windows 11 Pro",
    weight: "1.74 kg",
    ports: "USB-C, 2× USB-A, HDMI, RJ45",
    warranty: "1 month checking warranty",
    stock: 8,
    short: "Big 15.6\" screen with numeric keypad – the best budget laptop under Rs 100,000 for students and office.",
    body: `A practical **budget laptop under Rs 100,000** with an 11th Gen Core i5, Full HD 15.6" display and full-size keyboard with numpad. Upgrade to 16GB RAM at checkout for smoother multitasking.`,
    extra: { hotDeal: true, dealEndsAt: SEED_DEAL_END, rating: 4.5, soldCount: 120, createdAt: created(18) },
  }),
  laptop({
    id: "p-lenovo-ideapad-3",
    slug: "lenovo-ideapad-3-core-i3-12th-gen",
    name: "Lenovo IdeaPad 3 – Core i3 12th Gen, 8GB, 512GB SSD",
    brand: "lenovo",
    categoryId: "cat-student-laptops",
    price: 118000,
    condition: "new",
    processor: "Intel Core i3",
    cpuFull: "Intel Core i3-1215U (6 cores)",
    generation: "12th Gen",
    ramGb: 8,
    storageGb: 512,
    gpu: "Intel UHD Graphics",
    screen: '15.6" Full HD',
    screenSize: '15.6"',
    os: "Windows 11 Home",
    weight: "1.65 kg",
    ports: "USB-C, 2× USB-A, HDMI, SD card reader",
    warranty: "1 year official warranty",
    stock: 7,
    short: "Brand new student laptop with 12th Gen Core i3 and fast 512GB SSD.",
    body: `A reliable **student laptop** for online classes, assignments and Microsoft Office. Brand new with official warranty.`,
    extra: { rating: 4.4, soldCount: 40, createdAt: created(3) },
  }),
  laptop({
    id: "p-hp-pavilion-x360",
    slug: "hp-pavilion-x360-14-core-i5-11th-gen-touch",
    name: "HP Pavilion x360 14 – Core i5 11th Gen, 8GB, 512GB, Touch",
    brand: "hp",
    categoryId: "cat-2-in-1-laptops",
    price: 132000,
    salePrice: 124000,
    condition: "refurbished",
    conditionNotes: "Refurbished. Includes HP stylus pen. Battery health 87%.",
    processor: "Intel Core i5",
    cpuFull: "Intel Core i5-1135G7",
    generation: "11th Gen",
    ramGb: 8,
    storageGb: 512,
    gpu: "Intel Iris Xe Graphics",
    screen: '14" Full HD IPS touchscreen, 360° hinge',
    screenSize: '14"',
    touch: true,
    os: "Windows 11 Home",
    weight: "1.52 kg",
    ports: "USB-C, 2× USB-A, HDMI, microSD",
    warranty: "3 months warranty",
    stock: 3,
    short: "Flip it into a tablet – 2-in-1 touchscreen laptop with stylus, perfect for notes and design.",
    body: `The **HP Pavilion x360** folds 360° into tablet, tent or stand mode. Great for students who take handwritten notes.`,
    extra: { rating: 4.5, soldCount: 22, createdAt: created(8) },
  }),
  laptop({
    id: "p-dell-xps-13-9310",
    slug: "dell-xps-13-9310-core-i7-11th-gen",
    name: "Dell XPS 13 9310 – Core i7 11th Gen, 16GB, 512GB",
    brand: "dell",
    categoryId: "cat-used-refurbished-laptops",
    price: 175000,
    salePrice: 165000,
    condition: "used-a-plus",
    conditionNotes: "Battery health 89%. Like new. InfinityEdge display without dead pixels.",
    processor: "Intel Core i7",
    cpuFull: "Intel Core i7-1165G7",
    generation: "11th Gen",
    ramGb: 16,
    storageGb: 512,
    gpu: "Intel Iris Xe Graphics",
    screen: '13.4" FHD+ (1920×1200) InfinityEdge',
    screenSize: '13.4"',
    os: "Windows 11 Pro",
    weight: "1.2 kg",
    ports: "2× Thunderbolt 4, microSD",
    warranty: "3 months checking warranty",
    stock: 2,
    short: "Ultra-premium compact Windows laptop with a near-borderless display – Used A+.",
    body: `The **Dell XPS 13** is the Windows answer to the MacBook Air – CNC aluminium, carbon fibre palm rest and a stunning InfinityEdge display.`,
    extra: { featured: true, rating: 4.8, soldCount: 30, createdAt: created(2), upgrades: [] },
  }),
  laptop({
    id: "p-msi-gf63-rtx-4050",
    slug: "msi-gf63-thin-core-i7-12th-gen-rtx-4050",
    name: "MSI GF63 Thin – Core i7 12th Gen, RTX 4050, 16GB, 512GB",
    brand: "msi",
    categoryId: "cat-gaming-laptops",
    price: 285000,
    salePrice: 269000,
    condition: "new",
    processor: "Intel Core i7",
    cpuFull: "Intel Core i7-12650H (10 cores, up to 4.7GHz)",
    generation: "12th Gen",
    ramGb: 16,
    storageGb: 512,
    gpu: "NVIDIA GeForce RTX 4050 6GB",
    screen: '15.6" Full HD 144Hz IPS',
    screenSize: '15.6"',
    os: "Windows 11 Home",
    weight: "1.86 kg",
    ports: "USB-C, 3× USB-A, HDMI, RJ45",
    warranty: "1 year official warranty",
    stock: 2,
    short: "Thin & light RTX 4050 gaming laptop with DLSS 3 – brand new.",
    body: `RTX 40-series power in a thin 1.86 kg body. Perfect for gamers, video editors and 3D students.`,
    extra: { hotDeal: true, dealEndsAt: SEED_DEAL_END, rating: 4.7, soldCount: 19, createdAt: created(1), boughtTogether: ["p-redragon-h510", "p-redragon-k552", "p-razer-deathadder-essential"] },
  }),

  // ───────────────────────── Mouse ─────────────────────────
  make({
    id: "p-logitech-m185",
    slug: "logitech-m185-wireless-mouse",
    name: "Logitech M185 Wireless Mouse",
    brand: "logitech",
    categoryId: "cat-wireless-mouse",
    sku: "LOG-M185",
    shortDescription: "Reliable plug-and-play 2.4GHz wireless mouse with 12-month battery life.",
    description: `The **Logitech M185** is the most trusted wireless mouse for laptops. Plug in the nano receiver and start working – no software needed.

- 2.4GHz wireless up to 10m range
- Up to 12 months battery life on one AA battery
- Comfortable ambidextrous shape`,
    price: 3800,
    salePrice: 3500,
    stock: 40,
    warranty: "1 year Logitech warranty",
    specs: [
      { label: "Connectivity", value: "2.4GHz wireless (USB nano receiver)" },
      { label: "DPI", value: "1000" },
      { label: "Battery", value: "1× AA, up to 12 months" },
      { label: "Compatibility", value: "Windows, macOS, Linux, ChromeOS" },
    ],
    attributes: { connectivity: "Wireless", usage: "Office", rgb: false, dpi: 1000 },
    rating: 4.8,
    reviewCount: 2,
    soldCount: 560,
    bestSeller: true,
    featured: true,
    createdAt: created(60),
    wholesale: { available: true, minQty: 5 },
  }),
  make({
    id: "p-razer-deathadder-essential",
    slug: "razer-deathadder-essential-gaming-mouse",
    name: "Razer DeathAdder Essential Gaming Mouse",
    brand: "razer",
    categoryId: "cat-gaming-mouse",
    sku: "RZR-DAE",
    shortDescription: "Iconic ergonomic esports gaming mouse with 6400 DPI optical sensor.",
    description: `The **Razer DeathAdder Essential** brings the legendary ergonomic shape to an affordable price. 6400 DPI optical sensor and durable mechanical switches rated for 10 million clicks.`,
    price: 6500,
    stock: 15,
    warranty: "1 year warranty",
    specs: [
      { label: "Sensor", value: "6400 DPI optical" },
      { label: "Buttons", value: "5 programmable" },
      { label: "Connectivity", value: "Wired USB" },
      { label: "Lighting", value: "Green single-zone" },
    ],
    attributes: { connectivity: "Wired", usage: "Gaming", rgb: true, dpi: 6400 },
    rating: 4.7,
    soldCount: 190,
    createdAt: created(20),
  }),
  make({
    id: "p-a4tech-op-620d",
    slug: "a4tech-op-620d-wired-mouse",
    name: "A4Tech OP-620D Wired Mouse",
    brand: "a4tech",
    categoryId: "cat-wired-mouse",
    sku: "A4T-OP620D",
    shortDescription: "Durable wired USB office mouse – a Pakistani office favourite.",
    price: 1200,
    stock: 80,
    warranty: "6 months warranty",
    specs: [
      { label: "DPI", value: "1000" },
      { label: "Connectivity", value: "Wired USB, 1.5m cable" },
    ],
    attributes: { connectivity: "Wired", usage: "Office", rgb: false, dpi: 1000 },
    rating: 4.5,
    soldCount: 410,
    createdAt: created(90),
  }),

  // ───────────────────────── Keyboards ─────────────────────────
  make({
    id: "p-redragon-k552",
    slug: "redragon-k552-mechanical-gaming-keyboard",
    name: "Redragon K552 Kumara Mechanical Gaming Keyboard",
    brand: "redragon",
    categoryId: "cat-mechanical-keyboards",
    sku: "RDG-K552",
    shortDescription: "Compact tenkeyless mechanical keyboard with red backlight and Outemu Blue switches.",
    description: `The **Redragon K552 Kumara** is the best-selling mechanical keyboard in Pakistan. Tenkeyless (87-key) layout, metal top plate and clicky Outemu Blue switches.

- 87-key TKL design saves desk space
- Double-shot keycaps, anti-ghosting on all keys
- Splash-resistant`,
    price: 10500,
    salePrice: 9500,
    stock: 22,
    warranty: "6 months warranty",
    specs: [
      { label: "Switches", value: "Outemu Blue (clicky)" },
      { label: "Layout", value: "87-key TKL, US" },
      { label: "Backlight", value: "Red LED" },
      { label: "Connectivity", value: "Wired USB" },
    ],
    attributes: { connectivity: "Wired", usage: "Gaming", switchType: "Blue", layout: "TKL (87 keys)", rgb: true },
    rating: 4.8,
    reviewCount: 2,
    soldCount: 300,
    bestSeller: true,
    featured: true,
    createdAt: created(45),
  }),
  make({
    id: "p-logitech-k380",
    slug: "logitech-k380-wireless-bluetooth-keyboard",
    name: "Logitech K380 Multi-Device Bluetooth Keyboard",
    brand: "logitech",
    categoryId: "cat-wireless-keyboards",
    sku: "LOG-K380",
    shortDescription: "Slim, quiet Bluetooth keyboard that switches between 3 devices.",
    price: 11500,
    stock: 10,
    warranty: "1 year warranty",
    specs: [
      { label: "Connectivity", value: "Bluetooth (3 devices)" },
      { label: "Battery", value: "2× AAA, up to 24 months" },
    ],
    attributes: { connectivity: "Bluetooth", usage: "Office", layout: "Compact", rgb: false },
    rating: 4.7,
    soldCount: 85,
    createdAt: created(14),
  }),
  make({
    id: "p-hp-840-g5-keyboard",
    slug: "hp-elitebook-840-g5-replacement-keyboard",
    name: "HP EliteBook 840 G5 / G6 Replacement Keyboard (Backlit)",
    brand: "hp",
    categoryId: "cat-laptop-replacement-keyboards",
    sku: "HP-KB-840G5",
    shortDescription: "Backlit US layout replacement keyboard for HP EliteBook 840 G5 and 840 G6.",
    price: 4500,
    stock: 12,
    warranty: "1 month replacement warranty",
    specs: [
      { label: "Layout", value: "US English" },
      { label: "Backlight", value: "Yes" },
      { label: "Pointing stick", value: "Yes" },
    ],
    attributes: { connectivity: "Wired", usage: "Laptop Replacement", layout: "US", rgb: false },
    compatibility: ["hp-elitebook-840-g5", "hp-elitebook-840-g6"],
    rating: 4.6,
    soldCount: 48,
    createdAt: created(33),
  }),

  // ───────────────────────── Chargers ─────────────────────────
  make({
    id: "p-dell-65w-type-c",
    slug: "dell-65w-type-c-laptop-charger",
    name: "Dell 65W Type-C Laptop Charger",
    brand: "dell",
    categoryId: "cat-type-c-chargers",
    sku: "DELL-65W-USBC",
    shortDescription: "Original-quality Dell 65W USB-C power adapter for Latitude & XPS laptops.",
    description: `Charge your Dell Latitude or XPS at full speed with this **65W USB-C charger**. Also charges any USB-C PD laptop or phone.`,
    price: 7200,
    salePrice: 6500,
    stock: 25,
    warranty: "6 months warranty",
    specs: [
      { label: "Output", value: "20V ⎓ 3.25A (65W) USB-C PD" },
      { label: "Input", value: "100–240V AC" },
      { label: "Cable length", value: "1.8m" },
    ],
    attributes: { compatibleBrand: "Dell", wattage: "65W", connector: "USB Type-C" },
    compatibility: [
      "dell-latitude-5400", "dell-latitude-5410", "dell-latitude-5420", "dell-latitude-5430", "dell-latitude-7400",
      "dell-latitude-7410", "dell-latitude-7420", "dell-latitude-5300", "dell-xps-13-9310", "dell-xps-13-9300",
    ],
    rating: 4.7,
    reviewCount: 1,
    soldCount: 210,
    bestSeller: true,
    featured: true,
    createdAt: created(50),
  }),
  make({
    id: "p-hp-65w-blue-pin",
    slug: "hp-65w-blue-pin-laptop-charger",
    name: "HP 65W Smart Blue Pin Laptop Charger (4.5mm)",
    brand: "hp",
    categoryId: "cat-laptop-chargers",
    sku: "HP-65W-BP",
    shortDescription: "65W HP charger with 4.5mm blue pin for EliteBook, ProBook and Pavilion.",
    price: 3800,
    stock: 35,
    warranty: "6 months warranty",
    specs: [
      { label: "Output", value: "19.5V ⎓ 3.33A (65W)" },
      { label: "Connector", value: "4.5mm × 3.0mm blue pin" },
    ],
    attributes: { compatibleBrand: "HP", wattage: "65W", connector: "4.5mm Blue Pin" },
    compatibility: [
      "hp-elitebook-840-g3", "hp-elitebook-840-g4", "hp-elitebook-840-g5", "hp-elitebook-840-g6", "hp-elitebook-850-g5",
      "hp-elitebook-850-g6", "hp-elitebook-830-g5", "hp-elitebook-830-g6", "hp-probook-450-g5", "hp-probook-450-g6",
      "hp-probook-450-g7", "hp-probook-450-g8", "hp-probook-440-g8", "hp-pavilion-15",
    ],
    rating: 4.6,
    soldCount: 330,
    createdAt: created(70),
    wholesale: { available: true, minQty: 5 },
  }),
  make({
    id: "p-lenovo-65w-type-c",
    slug: "lenovo-65w-type-c-laptop-charger",
    name: "Lenovo 65W USB-C Laptop Charger",
    brand: "lenovo",
    categoryId: "cat-type-c-chargers",
    sku: "LEN-65W-USBC",
    shortDescription: "65W USB-C charger for ThinkPad and IdeaPad laptops.",
    price: 5200,
    stock: 18,
    warranty: "6 months warranty",
    specs: [{ label: "Output", value: "20V ⎓ 3.25A (65W) USB-C PD" }],
    attributes: { compatibleBrand: "Lenovo", wattage: "65W", connector: "USB Type-C" },
    compatibility: [
      "lenovo-thinkpad-t14-gen-1", "lenovo-thinkpad-t14-gen-2", "lenovo-thinkpad-t480", "lenovo-thinkpad-t490",
      "lenovo-thinkpad-x1-carbon-gen-7", "lenovo-thinkpad-x1-carbon-gen-8", "lenovo-thinkpad-e14", "lenovo-thinkpad-l14",
      "lenovo-ideapad-5-14",
    ],
    rating: 4.6,
    soldCount: 140,
    createdAt: created(28),
  }),
  make({
    id: "p-universal-90w-adapter",
    slug: "universal-90w-laptop-adapter-8-tips",
    name: "Universal 90W Laptop Adapter with 8 Tips",
    brand: "urko",
    categoryId: "cat-universal-adapters",
    sku: "UTS-UNI-90W",
    shortDescription: "One adapter for almost every laptop – adjustable voltage with 8 interchangeable tips.",
    price: 2800,
    stock: 30,
    warranty: "3 months warranty",
    specs: [
      { label: "Output", value: "15–24V adjustable, max 90W" },
      { label: "Tips", value: "8 (HP, Dell, Lenovo, Asus, Acer, Toshiba, Sony, Samsung)" },
    ],
    attributes: { compatibleBrand: "Universal", wattage: "90W", connector: "Multi-tip" },
    rating: 4.2,
    soldCount: 95,
    createdAt: created(80),
  }),

  // ───────────────────────── Batteries ─────────────────────────
  make({
    id: "p-hp-840-g5-battery",
    slug: "hp-elitebook-840-g5-replacement-battery",
    name: "HP EliteBook 840 G5 Replacement Battery (TT03XL)",
    brand: "hp",
    categoryId: "cat-hp-batteries",
    sku: "HP-BAT-TT03XL",
    shortDescription: "3-cell 50Wh TT03XL battery for HP EliteBook 840 G5, 840 G6, 850 G5 & 850 G6.",
    description: `Bring your EliteBook back to full-day battery life with this **TT03XL replacement battery**. Grade-A cells with overcharge protection. Free installation at our Saddar shop.`,
    price: 9500,
    salePrice: 8500,
    stock: 14,
    warranty: "6 months warranty",
    specs: [
      { label: "Model", value: "TT03XL" },
      { label: "Cells", value: "3-cell" },
      { label: "Capacity", value: "4330mAh / 50Wh" },
      { label: "Voltage", value: "11.55V" },
    ],
    attributes: { compatibleBrand: "HP", cells: "3-cell", capacity: 4330 },
    compatibility: ["hp-elitebook-840-g5", "hp-elitebook-840-g6", "hp-elitebook-850-g5", "hp-elitebook-850-g6"],
    rating: 4.6,
    reviewCount: 1,
    soldCount: 88,
    createdAt: created(35),
    wholesale: { available: true, minQty: 5 },
  }),
  make({
    id: "p-dell-5420-battery",
    slug: "dell-latitude-5420-replacement-battery",
    name: "Dell Latitude 5420 / 5430 Replacement Battery (4-cell 63Wh)",
    brand: "dell",
    categoryId: "cat-dell-batteries",
    sku: "DELL-BAT-5420",
    shortDescription: "4-cell 63Wh battery for Dell Latitude 5420 and 5430.",
    price: 11000,
    stock: 6,
    warranty: "6 months warranty",
    specs: [
      { label: "Cells", value: "4-cell" },
      { label: "Capacity", value: "4100mAh / 63Wh" },
    ],
    attributes: { compatibleBrand: "Dell", cells: "4-cell", capacity: 4100 },
    compatibility: ["dell-latitude-5420", "dell-latitude-5430"],
    rating: 4.5,
    soldCount: 30,
    createdAt: created(22),
  }),

  // ───────────────────────── Storage ─────────────────────────
  make({
    id: "p-kingston-nv2-512",
    slug: "kingston-nv2-512gb-nvme-ssd",
    name: "Kingston NV2 512GB NVMe M.2 SSD",
    brand: "kingston",
    categoryId: "cat-ssd",
    sku: "KNG-NV2-512",
    shortDescription: "PCIe 4.0 NVMe SSD with up to 3500MB/s read – the easiest speed upgrade for any laptop.",
    description: `Make your laptop boot in seconds. The **Kingston NV2 512GB** NVMe SSD is up to 6× faster than a SATA SSD. Free installation and Windows setup at our shop.`,
    price: 13000,
    salePrice: 12000,
    stock: 30,
    warranty: "3 years Kingston warranty",
    specs: [
      { label: "Capacity", value: "512GB" },
      { label: "Interface", value: "PCIe 4.0 ×4 NVMe" },
      { label: "Form factor", value: "M.2 2280" },
      { label: "Read / Write", value: "3500 / 2100 MB/s" },
    ],
    attributes: { capacity: "512GB", type: "NVMe SSD", interface: "M.2 PCIe", readSpeed: 3500 },
    compatibility: [
      "hp-elitebook-840-g5", "hp-elitebook-840-g6", "hp-elitebook-840-g7", "hp-elitebook-840-g8", "dell-latitude-5420",
      "dell-latitude-5410", "lenovo-thinkpad-t14-gen-1", "lenovo-thinkpad-t14-gen-2", "lenovo-thinkpad-t480", "asus-tuf-gaming-f15",
      "acer-nitro-5", "hp-probook-450-g8",
    ],
    rating: 4.8,
    reviewCount: 1,
    soldCount: 260,
    bestSeller: true,
    featured: true,
    createdAt: created(15),
    wholesale: { available: true, minQty: 5 },
  }),
  make({
    id: "p-samsung-870-evo-500",
    slug: "samsung-870-evo-500gb-sata-ssd",
    name: "Samsung 870 EVO 500GB 2.5\" SATA SSD",
    brand: "samsung",
    categoryId: "cat-ssd",
    sku: "SAM-870EVO-500",
    shortDescription: "Industry-leading SATA SSD – perfect for upgrading older laptops with a hard drive.",
    price: 16500,
    salePrice: 15500,
    stock: 12,
    warranty: "5 years Samsung warranty",
    specs: [
      { label: "Capacity", value: "500GB" },
      { label: "Interface", value: "SATA III 6Gb/s" },
      { label: "Read / Write", value: "560 / 530 MB/s" },
    ],
    attributes: { capacity: "500GB", type: "SATA SSD", interface: "SATA 2.5\"", readSpeed: 560 },
    rating: 4.9,
    soldCount: 110,
    createdAt: created(27),
  }),
  make({
    id: "p-kingston-datatraveler-64",
    slug: "kingston-datatraveler-exodia-64gb-usb",
    name: "Kingston DataTraveler Exodia 64GB USB 3.2 Flash Drive",
    brand: "kingston",
    categoryId: "cat-usb-flash-drives",
    sku: "KNG-DTX-64",
    shortDescription: "Fast USB 3.2 flash drive with protective cap and key ring.",
    price: 1500,
    stock: 60,
    warranty: "5 years warranty",
    specs: [
      { label: "Capacity", value: "64GB" },
      { label: "Interface", value: "USB 3.2 Gen 1" },
    ],
    attributes: { capacity: "64GB", type: "USB Flash", interface: "USB-A", readSpeed: 100 },
    rating: 4.6,
    soldCount: 230,
    createdAt: created(55),
  }),

  // ───────────────────────── RAM ─────────────────────────
  make({
    id: "p-kingston-16gb-ddr4-3200",
    slug: "kingston-16gb-ddr4-3200mhz-laptop-ram",
    name: "Kingston 16GB DDR4 3200MHz Laptop RAM (SO-DIMM)",
    brand: "kingston",
    categoryId: "cat-ddr4-ram",
    sku: "KNG-16-D4-3200-SO",
    shortDescription: "Upgrade to 16GB for smooth multitasking – compatible with most 8th–12th Gen laptops.",
    price: 9500,
    salePrice: 9000,
    stock: 26,
    warranty: "Lifetime Kingston warranty",
    specs: [
      { label: "Capacity", value: "16GB (1×16GB)" },
      { label: "Type", value: "DDR4 SO-DIMM" },
      { label: "Speed", value: "3200MHz (backward compatible 2666/2400)" },
      { label: "Voltage", value: "1.2V" },
    ],
    attributes: { capacity: "16GB", type: "DDR4", formFactor: "Laptop (SO-DIMM)", speed: "3200MHz" },
    compatibility: [
      "hp-elitebook-840-g5", "hp-elitebook-840-g6", "hp-elitebook-840-g7", "hp-elitebook-840-g8", "hp-elitebook-850-g5",
      "hp-probook-450-g6", "hp-probook-450-g7", "hp-probook-450-g8", "dell-latitude-5400", "dell-latitude-5410",
      "dell-latitude-5420", "dell-latitude-5430", "dell-latitude-7400", "dell-inspiron-15-3511", "lenovo-thinkpad-t480",
      "lenovo-thinkpad-t490", "lenovo-thinkpad-t14-gen-1", "lenovo-thinkpad-t14-gen-2", "lenovo-ideapad-3-15",
      "asus-tuf-gaming-f15", "asus-vivobook-15", "acer-aspire-5", "acer-nitro-5", "hp-pavilion-15",
    ],
    rating: 4.8,
    soldCount: 310,
    bestSeller: true,
    createdAt: created(42),
  }),
  make({
    id: "p-kingston-fury-16gb-ddr5",
    slug: "kingston-fury-impact-16gb-ddr5-4800mhz-laptop-ram",
    name: "Kingston FURY Impact 16GB DDR5 4800MHz Laptop RAM",
    brand: "kingston",
    categoryId: "cat-ddr5-ram",
    sku: "KNG-FURY-16-D5",
    shortDescription: "DDR5 SO-DIMM for 12th Gen+ and Ryzen 6000+ laptops.",
    price: 14500,
    stock: 9,
    warranty: "Lifetime Kingston warranty",
    specs: [
      { label: "Capacity", value: "16GB" },
      { label: "Type", value: "DDR5 SO-DIMM" },
      { label: "Speed", value: "4800MHz" },
    ],
    attributes: { capacity: "16GB", type: "DDR5", formFactor: "Laptop (SO-DIMM)", speed: "4800MHz" },
    rating: 4.7,
    soldCount: 44,
    createdAt: created(6),
  }),

  // ───────────────────────── Audio ─────────────────────────
  make({
    id: "p-redragon-h510",
    slug: "redragon-h510-zeus-gaming-headset",
    name: "Redragon H510 Zeus 7.1 Surround Gaming Headset",
    brand: "redragon",
    categoryId: "cat-gaming-headsets",
    sku: "RDG-H510",
    shortDescription: "Virtual 7.1 surround sound, memory foam ear cups and detachable mic.",
    price: 10500,
    salePrice: 9800,
    stock: 11,
    warranty: "6 months warranty",
    specs: [
      { label: "Drivers", value: "53mm" },
      { label: "Surround", value: "Virtual 7.1 (USB)" },
      { label: "Connectivity", value: "USB / 3.5mm" },
    ],
    attributes: { connectivity: "Wired", type: "Over-ear", mic: true, anc: false },
    rating: 4.6,
    soldCount: 75,
    createdAt: created(19),
  }),
  make({
    id: "p-logitech-h390",
    slug: "logitech-h390-usb-headset",
    name: "Logitech H390 USB Headset with Noise-Cancelling Mic",
    brand: "logitech",
    categoryId: "cat-headphones",
    sku: "LOG-H390",
    shortDescription: "Comfortable USB headset for Zoom, Teams and online classes.",
    price: 7500,
    stock: 16,
    warranty: "1 year warranty",
    specs: [{ label: "Connectivity", value: "USB-A, 1.9m cable" }],
    attributes: { connectivity: "Wired", type: "On-ear", mic: true, anc: false },
    rating: 4.5,
    soldCount: 60,
    createdAt: created(38),
  }),

  // ───────────────────────── Laptop accessories ─────────────────────────
  make({
    id: "p-cooling-pad-5-fans",
    slug: "laptop-cooling-pad-5-fans-rgb",
    name: "Laptop Cooling Pad with 5 Fans & RGB",
    brand: "urko",
    categoryId: "cat-cooling-pads",
    sku: "UTS-CP-5F",
    shortDescription: "5 quiet fans, 6 height levels and 2 USB ports – keeps gaming laptops cool.",
    description: `Drop your laptop temperatures by up to 15°C. **5 fans**, adjustable height and phone holder. Fits laptops up to 17".`,
    price: 3500,
    salePrice: 3000,
    stock: 28,
    warranty: "3 months warranty",
    specs: [
      { label: "Fans", value: "5 (1× 120mm + 4× 70mm)" },
      { label: "Fits", value: "Up to 17.3\"" },
      { label: "Power", value: "USB" },
    ],
    attributes: { fitsSize: 'Up to 17"', material: "Metal mesh + ABS" },
    rating: 4.5,
    soldCount: 180,
    bestSeller: true,
    createdAt: created(24),
  }),
  make({
    id: "p-laptop-backpack-156",
    slug: "anti-theft-laptop-backpack-15-6-inch",
    name: "Anti-Theft Laptop Backpack 15.6\" with USB Port",
    brand: "urko",
    categoryId: "cat-bags-sleeves",
    sku: "UTS-BP-156",
    shortDescription: "Water-resistant anti-theft backpack with padded laptop compartment and USB charging port.",
    price: 4500,
    salePrice: 3800,
    stock: 20,
    warranty: "1 month warranty",
    specs: [
      { label: "Fits", value: "Up to 15.6\" laptops" },
      { label: "Material", value: "Water-resistant polyester" },
    ],
    attributes: { fitsSize: '15.6"', material: "Polyester" },
    rating: 4.6,
    soldCount: 140,
    createdAt: created(31),
  }),
  make({
    id: "p-laptop-stand-aluminium",
    slug: "adjustable-aluminium-laptop-stand",
    name: "Adjustable Aluminium Laptop Stand",
    brand: "urko",
    categoryId: "cat-laptop-stands",
    sku: "UTS-STAND-AL",
    shortDescription: "Foldable aluminium stand – raises your screen to eye level for better posture.",
    price: 2500,
    stock: 25,
    warranty: "1 month warranty",
    specs: [{ label: "Material", value: "Aluminium alloy" }],
    attributes: { fitsSize: '10–17"', material: "Aluminium" },
    rating: 4.7,
    soldCount: 90,
    createdAt: created(9),
  }),

  // ───────────────────────── Cables & hubs ─────────────────────────
  make({
    id: "p-usb-c-hub-7in1",
    slug: "7-in-1-usb-c-hub-hdmi-4k",
    name: "7-in-1 USB-C Hub – 4K HDMI, 100W PD, SD/TF, 3× USB 3.0",
    brand: "ugreen",
    categoryId: "cat-usb-hubs",
    sku: "UGR-HUB-7IN1",
    shortDescription: "Turn one USB-C port into HDMI 4K, 3 USB-A, SD/microSD and 100W pass-through charging.",
    description: `The perfect companion for MacBooks and modern laptops. One cable gives you **4K HDMI**, three USB 3.0 ports, SD and microSD readers and **100W PD charging**.`,
    price: 6500,
    salePrice: 5500,
    stock: 24,
    warranty: "6 months warranty",
    specs: [
      { label: "Ports", value: "HDMI 4K@30Hz, 3× USB-A 3.0, SD, microSD, USB-C PD 100W" },
      { label: "Connector", value: "USB Type-C" },
    ],
    attributes: { ports: "7-in-1", connector: "USB Type-C", length: "15cm" },
    rating: 4.7,
    reviewCount: 1,
    soldCount: 170,
    bestSeller: true,
    featured: true,
    createdAt: created(16),
  }),
  make({
    id: "p-hdmi-cable-4k-1-5m",
    slug: "4k-hdmi-cable-1-5m",
    name: "4K HDMI 2.0 Cable – 1.5m Braided",
    brand: "ugreen",
    categoryId: "cat-hdmi-cables",
    sku: "UGR-HDMI-15",
    shortDescription: "Braided 4K@60Hz HDMI cable for monitors, TVs and projectors.",
    price: 900,
    stock: 70,
    warranty: "3 months warranty",
    specs: [
      { label: "Length", value: "1.5m" },
      { label: "Spec", value: "HDMI 2.0, 4K@60Hz, 18Gbps" },
    ],
    attributes: { ports: "HDMI", connector: "HDMI", length: "1.5m" },
    rating: 4.6,
    soldCount: 220,
    createdAt: created(48),
  }),

  // ───────────────────────── Networking ─────────────────────────
  make({
    id: "p-tp-link-archer-c6",
    slug: "tp-link-archer-c6-ac1200-router",
    name: "TP-Link Archer C6 AC1200 Dual-Band Wi-Fi Router",
    brand: "tp-link",
    categoryId: "cat-routers",
    sku: "TPL-C6",
    shortDescription: "Dual-band AC1200 router with 4 antennas and gigabit ports.",
    price: 8200,
    salePrice: 7800,
    stock: 10,
    warranty: "1 year warranty",
    specs: [
      { label: "Speed", value: "867 Mbps (5GHz) + 300 Mbps (2.4GHz)" },
      { label: "Ports", value: "4× Gigabit LAN, 1× Gigabit WAN" },
    ],
    attributes: { wifiStandard: "Wi-Fi 5 (AC)", speed: "AC1200", band: "Dual-band" },
    rating: 4.6,
    soldCount: 65,
    createdAt: created(37),
  }),
  make({
    id: "p-tp-link-archer-t2u",
    slug: "tp-link-archer-t2u-plus-wifi-adapter",
    name: "TP-Link Archer T2U Plus AC600 USB Wi-Fi Adapter",
    brand: "tp-link",
    categoryId: "cat-wifi-adapters",
    sku: "TPL-T2U",
    shortDescription: "Add fast dual-band Wi-Fi to any PC or laptop.",
    price: 2900,
    stock: 22,
    warranty: "1 year warranty",
    specs: [{ label: "Speed", value: "AC600 dual-band" }],
    attributes: { wifiStandard: "Wi-Fi 5 (AC)", speed: "AC600", band: "Dual-band" },
    rating: 4.4,
    soldCount: 58,
    createdAt: created(52),
  }),

  // ───────────────────────── Monitors & webcams ─────────────────────────
  make({
    id: "p-samsung-24-ips-monitor",
    slug: "samsung-24-inch-ips-75hz-monitor",
    name: "Samsung 24\" IPS Full HD 75Hz Monitor (LF24T350)",
    brand: "samsung",
    categoryId: "cat-monitors",
    sku: "SAM-LF24T350",
    shortDescription: "Borderless 24\" IPS monitor with 75Hz and AMD FreeSync.",
    price: 34000,
    salePrice: 32000,
    stock: 6,
    warranty: "1 year warranty",
    specs: [
      { label: "Size", value: '24"' },
      { label: "Resolution", value: "1920×1080" },
      { label: "Refresh rate", value: "75Hz" },
      { label: "Ports", value: "HDMI, VGA" },
    ],
    attributes: { screenSize: '24"', resolution: "Full HD", refreshRate: "75Hz", panel: "IPS" },
    rating: 4.7,
    soldCount: 40,
    createdAt: created(21),
  }),
  make({
    id: "p-logitech-c270",
    slug: "logitech-c270-hd-webcam",
    name: "Logitech C270 HD Webcam 720p",
    brand: "logitech",
    categoryId: "cat-webcams",
    sku: "LOG-C270",
    shortDescription: "Plug-and-play HD webcam with built-in noise-reducing mic.",
    price: 6500,
    stock: 14,
    warranty: "1 year warranty",
    specs: [
      { label: "Resolution", value: "720p @ 30fps" },
      { label: "Microphone", value: "Built-in, noise reducing" },
    ],
    attributes: { resolution: "720p", mic: true },
    rating: 4.5,
    soldCount: 70,
    createdAt: created(44),
  }),

  // ───────────────────────── Wholesale lots (price on request – quote only) ─────────────────────────
  make({
    id: "p-lot-hp-elitebook-840-g5-x20",
    slug: "wholesale-lot-20-hp-elitebook-840-g5-core-i5-8th-gen",
    name: "Wholesale Lot – 20× HP EliteBook 840 G5 Core i5 8th Gen (Grade A)",
    brand: "hp",
    categoryId: "cat-wholesale-lots",
    sku: "LOT-HP840G5-20",
    shortDescription: "Bulk lot of 20 identical HP EliteBook 840 G5 business laptops – Core i5 8th Gen, 8GB RAM, 256GB SSD, Grade A. Ideal for offices, labs and resellers.",
    description: `A matched **lot of 20 HP EliteBook 840 G5** laptops – the same model, the same specs, perfect for offices, call centres, computer labs and resellers who want uniform stock.

### What's in the lot
- 20× HP EliteBook 840 G5 – Intel Core i5-8350U (8th Gen), 8GB DDR4, 256GB SSD, 14" Full HD
- Original HP 65W chargers with every unit
- Windows 10/11 Pro installed and activated on request

### Grading
**Grade A** – clean bodies with only light signs of use, no broken hinges, no dead pixels. Battery health 75%+ on every unit. Each laptop is checked & tested on 30+ points in our Saddar, Karachi workshop.

### Price
Wholesale price **on request** – it depends on quantity, RAM/SSD upgrades and the current dollar rate. Request a quote and we'll send prices, photos and a video of the actual stock.`,
    price: 0,
    priceOnRequest: true,
    stock: 3,
    condition: "used-a",
    warranty: "15 days checking warranty on every unit",
    specs: [
      { label: "Units in lot", value: "20" },
      { label: "Model", value: "HP EliteBook 840 G5" },
      { label: "Processor", value: "Intel Core i5-8350U (8th Gen)" },
      { label: "RAM / Storage", value: "8GB DDR4 / 256GB SSD" },
      { label: "Display", value: '14" Full HD IPS' },
      { label: "Grade", value: "Grade A" },
      { label: "Included", value: "Original 65W charger per unit" },
    ],
    attributes: { lotSize: 20, grade: "Grade A", brandMix: "HP", processor: "Core i5 8th Gen" },
    wholesale: {
      available: true,
      minQty: 1,
      lotSize: 20,
      grades: "Grade A",
      contents: "20× HP EliteBook 840 G5 – Core i5 8th Gen, 8GB RAM, 256GB SSD, 14\" FHD, with chargers",
      note: "RAM / SSD upgrades available for the whole lot.",
    },
    rating: 0,
    tags: ["wholesale", "bulk laptops", "elitebook lot"],
    createdAt: created(5),
  }),
  make({
    id: "p-lot-mixed-dell-hp-i5-8th-x25",
    slug: "wholesale-lot-25-mixed-dell-hp-core-i5-8th-gen",
    name: "Wholesale Lot – 25 Mixed Dell & HP Core i5 8th Gen Laptops (Grade A/B)",
    brand: "mixed-brands",
    categoryId: "cat-wholesale-lots",
    sku: "LOT-MIX-I5G8-25",
    shortDescription: "Mixed pallet of 25 Dell Latitude & HP EliteBook/ProBook business laptops – Core i5 8th Gen, Grade A/B. Great value for shops and resellers.",
    description: `A **mixed lot of 25 business laptops** – Dell Latitude and HP EliteBook / ProBook models, all Intel Core i5 8th Gen. The best value way for computer shops and online resellers to stock up.

### Typical contents
- 10–12× Dell Latitude 7490 / 5490
- 8–10× HP EliteBook 840 G5 / 830 G5
- 3–5× HP ProBook 450 G5 / 440 G5
- Exact model list shared with your quote

### Grading
Mixed **Grade A and Grade B**: Grade A units have light marks only; Grade B units have visible scratches or worn palm-rests but work 100%. Every unit is checked & tested; RAM is 8GB, storage 256GB SSD (upgradable).

### Price
Wholesale price **on request** – send a quote request with your quantity and city.`,
    price: 0,
    priceOnRequest: true,
    stock: 2,
    condition: "used-a",
    warranty: "15 days checking warranty on every unit",
    specs: [
      { label: "Units in lot", value: "25" },
      { label: "Brands", value: "Dell & HP" },
      { label: "Processor", value: "Intel Core i5 8th Gen" },
      { label: "RAM / Storage", value: "8GB / 256GB SSD" },
      { label: "Grade", value: "Mixed Grade A / B" },
      { label: "Chargers", value: "Included (compatible)" },
    ],
    attributes: { lotSize: 25, grade: "Grade A/B", brandMix: "Dell & HP", processor: "Core i5 8th Gen" },
    wholesale: {
      available: true,
      minQty: 1,
      lotSize: 25,
      grades: "Grade A / B",
      contents: "Dell Latitude 7490/5490, HP EliteBook 840/830 G5, HP ProBook 450/440 G5 – all Core i5 8th Gen, 8GB, 256GB SSD",
      note: "Exact model split shared with the quote.",
    },
    rating: 0,
    tags: ["wholesale", "mixed lot", "used laptop lot"],
    createdAt: created(6),
  }),
  make({
    id: "p-lot-chargers-65w-x50",
    slug: "wholesale-lot-50-laptop-chargers-hp-dell-lenovo-65w",
    name: "Bulk Lot – 50× Laptop Chargers 65W (HP, Dell & Lenovo)",
    brand: "mixed-brands",
    categoryId: "cat-wholesale-lots",
    sku: "LOT-CHG65-50",
    shortDescription: "Bulk pack of 50 tested 65W laptop chargers – HP blue pin, Dell, Lenovo and USB-C – for repair shops and resellers.",
    description: `A **bulk lot of 50 laptop chargers** for repair shops, computer markets and resellers.

### Typical contents
- HP 65W blue pin (4.5mm) & Smart pin
- Dell 65W (4.5mm / 7.4mm) and USB-C
- Lenovo 65W USB-C & square tip

Mix and quantities can be adjusted to your needs – tell us what sells in your shop.

### Price
Bulk price **on request**.`,
    price: 0,
    priceOnRequest: true,
    stock: 5,
    condition: "new",
    warranty: "1 month replacement warranty",
    specs: [
      { label: "Units in lot", value: "50" },
      { label: "Brands", value: "HP, Dell, Lenovo" },
      { label: "Wattage", value: "65W" },
      { label: "Condition", value: "New / OEM pulls, all tested" },
    ],
    attributes: { lotSize: 50, grade: "New", brandMix: "HP, Dell & Lenovo" },
    wholesale: {
      available: true,
      minQty: 1,
      lotSize: 50,
      grades: "New / tested OEM",
      contents: "Mixed 65W chargers for HP, Dell and Lenovo – split adjustable",
    },
    rating: 0,
    tags: ["wholesale", "bulk chargers"],
    createdAt: created(8),
  }),
];
