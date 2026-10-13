import type { Payload, SanitizedPermissions, TypedUser } from "payload";
import { Logout } from "@payloadcms/ui";
import { NavHamburger, NavWrapper } from "@payloadcms/next/client";
import { NavLinks, type NavItem, type NavSection } from "./NavLinks";
import { Icon as BrandMark } from "../Brand";

/**
 * Admin sidebar, grouped by job like Shopify (Home, Orders, Products, Customers, Wholesale, Online store,
 * Marketing, Delivery & payments, Settings). Items a person can't use are left out – never greyed out.
 * Badges: orders to confirm, new wholesale enquiries.
 */

type Props = {
  payload: Payload;
  permissions?: SanitizedPermissions;
  user?: TypedUser | null;
  visibleEntities?: { collections: string[]; globals: string[] };
};

const ADMIN = "/cms";

export async function UrkoNav({ payload, permissions, user, visibleEntities }: Props) {
  const collections = new Set(visibleEntities?.collections ?? []);
  const globals = new Set(visibleEntities?.globals ?? []);
  const perms = (permissions ?? {}) as { collections?: Record<string, { read?: boolean; update?: boolean }>; globals?: Record<string, { read?: boolean; update?: boolean }> };
  const canRead = (slug: string) => collections.has(slug) && perms.collections?.[slug]?.read !== false;
  const canEditGlobal = (slug: string) => globals.has(slug) && perms.globals?.[slug]?.update === true;
  const col = (slug: string, label: string, query = "") => (canRead(slug) ? { label, href: `${ADMIN}/collections/${slug}${query}`, match: `${ADMIN}/collections/${slug}` } : null);
  const glob = (slug: string, label: string) => (canEditGlobal(slug) ? { label, href: `${ADMIN}/globals/${slug}`, match: `${ADMIN}/globals/${slug}` } : null);

  /** only the address of a link (the section keeps its own label) */
  const at = (l: NavItem | null) => (l ? { href: l.href, match: l.match } : { href: "" });

  const [pendingOrders, newWholesale] = await Promise.all([
    canRead("orders") ? payload.count({ collection: "orders", where: { status: { equals: "pending" } }, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0) : 0,
    canRead("wholesale-inquiries") ? payload.count({ collection: "wholesale-inquiries", where: { status: { equals: "new" } }, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0) : 0,
  ]);

  const role = (user as { role?: string } | null)?.role;
  type RawSection = Omit<NavSection, "children"> & { children?: (NavItem | null)[] };
  const raw: RawSection[] = [
    { label: "Home", icon: "home", href: ADMIN, exact: true },
    {
      label: "Orders",
      icon: "orders",
      ...at(col("orders", "Orders")),
      badge: pendingOrders || undefined,
      badgeLabel: "to confirm",
      children: canRead("orders")
        ? [
            col("orders", "All orders"),
            col("return-requests", "Returns"),
            col("warranty-claims", "Warranty claims"),
            { label: "Refused parcels (RTO)", href: `${ADMIN}/reports/rto`, match: `${ADMIN}/reports/rto` },
            col("blocked-phones", "Blocked numbers"),
          ]
        : [],
    },
    {
      label: "Shop counter",
      icon: "pos",
      ...(canRead("pos-sales") ? { href: `${ADMIN}/pos`, match: `${ADMIN}/pos` } : { href: "" }),
      children: canRead("pos-sales") ? [{ label: "Sell", href: `${ADMIN}/pos`, match: `${ADMIN}/pos` }, col("pos-sales", "Shop sales"), col("cash-ups", "Cash-ups")] : [],
    },
    {
      label: "Products",
      icon: "products",
      ...at(col("products", "Products")),
      children: [
        col("products", "All products"),
        col("units", "Laptop units (serials)"),
        col("product-questions", "Questions"),
        canRead("stock-counts") ? { label: "Stock count", href: `${ADMIN}/stock-count`, match: `${ADMIN}/stock-count` } : null,
        col("purchases", "Purchases (stock in)"),
        col("suppliers", "Suppliers"),
        col("products", "Inventory", "?where%5BstockStatus%5D%5Bin%5D%5B0%5D=low&where%5BstockStatus%5D%5Bin%5D%5B1%5D=out"),
        col("stock-movements", "Stock history"),
        col("categories", "Categories"),
        col("brands", "Brands"),
        col("product-collections", "Collections"),
        col("laptop-models", "Laptop models"),
        col("imports", "Import"),
        col("exports", "Export"),
      ],
    },
    {
      label: "Customers",
      icon: "customers",
      ...at(col("users", "Customers", "?where%5Brole%5D%5Bequals%5D=customer")),
      children: [col("users", "All customers", "?where%5Brole%5D%5Bequals%5D=customer"), col("contact-messages", "Messages"), col("trade-ins", "Trade-ins (sell your laptop)")],
    },
    { label: "Wholesale", icon: "wholesale", ...at(col("wholesale-inquiries", "Wholesale")), badge: newWholesale || undefined, badgeLabel: "new" },
    {
      label: "Reports",
      icon: "reports",
      ...(role === "owner" || role === "manager" ? { href: `${ADMIN}/reports/sales`, match: `${ADMIN}/reports/sales` } : at(col("stock-movements", "Stock history"))),
      children: [
        role === "owner" || role === "manager" ? { label: "Sales & profit", href: `${ADMIN}/reports/sales`, match: `${ADMIN}/reports/sales` } : null,
        canRead("orders") ? { label: "Refused parcels (RTO)", href: `${ADMIN}/reports/rto`, match: `${ADMIN}/reports/rto` } : null,
        col("stock-movements", "Stock history"),
        col("activity-log", "Activity log"),
      ],
    },
    {
      label: "Online store",
      icon: "store",
      ...at(col("pages", "Online store")),
      children: [
        col("pages", "Home page & pages"),
        glob("theme-settings", "Theme"),
        col("menus", "Menus"),
        glob("header", "Header"),
        glob("footer", "Footer"),
        glob("announcement-bar", "Announcement bar"),
        glob("whatsapp-button", "WhatsApp button"),
        col("posts", "Blog"),
        glob("page-texts", "Page texts"),
        glob("testimonials", "Testimonials"),
        glob("faqs", "FAQs"),
        col("media", "Photos & files"),
      ],
    },
    {
      label: "Marketing",
      icon: "marketing",
      ...at(col("discounts", "Marketing")),
      children: [
        col("discounts", "Discount codes"),
        col("flash-sales", "Flash sales"),
        col("reviews", "Reviews"),
        col("abandoned-carts", "Abandoned carts"),
        col("stock-alerts", "Stock & price alerts"),
      ],
    },
    {
      label: "Delivery & payments",
      icon: "delivery",
      ...at(glob("shipping", "Delivery") ?? glob("payments", "Payments")),
      children: [glob("shipping", "Delivery charges"), glob("payments", "Payment methods")],
    },
    {
      label: "Settings",
      icon: "settings",
      ...at(glob("store-info", "Settings") ?? glob("notifications", "Settings")),
      children: [
        glob("store-info", "Store details"),
        role === "owner" || role === "manager" ? col("users", "Staff", "?where%5Brole%5D%5Bnot_equals%5D=customer") : null,
        { label: "My security (2-step)", href: `${ADMIN}/security`, match: `${ADMIN}/security` },
        role === "owner" || role === "manager" ? { label: "Customer data requests", href: `${ADMIN}/privacy`, match: `${ADMIN}/privacy` } : null,
        glob("notifications", "Notifications"),
        glob("order-protection", "Fake order protection"),
        glob("returns-policy", "Returns & warranty rules"),
        glob("seo-settings", "Google & SEO"),
        glob("cookie-notice", "Cookie notice"),
        glob("sales-channels", "Sales channels (feeds)"),
        glob("conversion", "Installments & reminders"),
        glob("staff-guide", "Staff guide"),
        col("redirects", "Redirects"),
      ],
    },
    { label: "Help", icon: "help", href: `${ADMIN}/help`, match: `${ADMIN}/help` },
  ];
  const sections: NavSection[] = raw
    .map((s) => ({ ...s, children: s.children?.filter((c): c is NavItem => Boolean(c)) }))
    .filter((s) => s.href || (s.children && s.children.length));

  return (
    <NavWrapper baseClass="nav">
      <nav className="nav__wrap urko-nav" aria-label="Admin menu">
        <a className="urko-nav__brand" href={ADMIN}>
          <BrandMark />
          <span>
            <strong>Urko</strong>
            <small>Tech Store</small>
          </span>
        </a>
        <NavLinks sections={sections} />
        <div className="nav__controls urko-nav__controls">
          <Logout />
        </div>
      </nav>
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  );
}
