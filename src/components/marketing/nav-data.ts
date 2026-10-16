/** The marketing site's menus (header, mobile menu and footer read the same lists). */

export type NavItem = { label: string; href: string; text?: string; icon?: "Store" | "ScanBarcode" | "Briefcase" | "LayoutGrid" | "CreditCard" | "ShieldCheck" | "BookOpen" | "CircleHelp" | "Info" | "Mail" | "Rocket" };

export const PRODUCT_MENU: { title: string; items: NavItem[] }[] = [
  {
    title: "Solutions",
    items: [
      { label: "Multi-store management", href: "/solutions/multi-store", text: "Run several independent shops from one account", icon: "Store" },
      { label: "Retail & point of sale", href: "/solutions/retail", text: "Sell online and in store from one inventory", icon: "ScanBarcode" },
      { label: "For agencies", href: "/solutions/agencies", text: "Build and look after stores for clients", icon: "Briefcase" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "All features", href: "/features", text: "Products, orders, payments, teams and more", icon: "LayoutGrid" },
      { label: "Payments", href: "/features#payments", text: "Cash on delivery, transfers, local wallets, cards", icon: "CreditCard" },
      { label: "Security", href: "/security", text: "How each store's data is kept separate", icon: "ShieldCheck" },
    ],
  },
];

export const RESOURCES_MENU: { title: string; items: NavItem[] }[] = [
  {
    title: "Learn",
    items: [
      { label: "Blog", href: "/blog", text: "Guides for running online stores", icon: "BookOpen" },
      { label: "How it works", href: "/how-it-works", text: "From sign-up to your first order", icon: "Rocket" },
      { label: "FAQ", href: "/faq", text: "Answers about stores, payments and plans", icon: "CircleHelp" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about", text: "Why we built ShopEngine", icon: "Info" },
      { label: "Contact", href: "/contact", text: "Talk to the ShopEngine team", icon: "Mail" },
    ],
  },
];

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [ { label: "Features", href: "/features" }, { label: "Pricing", href: "/pricing" }, { label: "Security", href: "/security" }, { label: "How it works", href: "/how-it-works" } ] },
  { title: "Solutions", links: [ { label: "Multi-store", href: "/solutions/multi-store" }, { label: "Retail & POS", href: "/solutions/retail" }, { label: "Agencies", href: "/solutions/agencies" } ] },
  { title: "Resources", links: [ { label: "Blog", href: "/blog" }, { label: "Help center", href: "/faq" }, { label: "Getting started", href: "/how-it-works" } ] },
  { title: "Company", links: [ { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }, { label: "Privacy policy", href: "/privacy" }, { label: "Terms of service", href: "/terms" } ] },
];
