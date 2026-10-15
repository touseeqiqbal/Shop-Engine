"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNav } from "@payloadcms/ui";
import { Icon } from "../ui/icons";
import { useAdminMoney } from "../ui/store-context";
import { formatMoney, type Money } from "../../../lib/money";

/**
 * Header tools for every admin screen: global search (Ctrl/Cmd+K or "/"), "+ Add" menu, notifications bell,
 * and – on phones – a bottom bar (Home, Orders, Products, Search, More).
 */

const ADMIN = "/cms";
const API = "/cms-api";

type Result = { group: "Orders" | "Products" | "Customers"; title: string; sub: string; href: string; thumb?: string };
type Todo = { pendingOrders: number; paymentsToVerify: number; lowStockTotal: number; outOfStockTotal: number; newWholesale: number; openMessages: number };

const q =(params: Record<string, string>) => Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Docs = { docs: Record<string, unknown>[] };

/** `money` = the store's; an order shows in the currency it was placed in. */
async function search(term: string, money: Money): Promise<Result[]> {
  const digits = term.replace(/\D/g, "");
  // phone numbers are stored like 0300-1234567: match on the last 7 digits
  const phone = digits.length >= 7 ? digits.slice(-7) : "";
  const orderWhere: Record<string, string> = { "where[or][0][orderNumber][like]": term, "where[or][1][customer.name][like]": term };
  if (phone) orderWhere["where[or][2][customer.phone][like]"] = phone;
  const userWhere: Record<string, string> = { "where[or][0][name][like]": term, "where[or][1][email][like]": term };
  if (phone) userWhere["where[or][2][phone][like]"] = phone;
  const [orders, products, users] = await Promise.all([
    getJson<Docs>(`${API}/orders?${q({ ...orderWhere, limit: "5", depth: "0", sort: "-placedAt" })}`),
    getJson<Docs>(`${API}/products?${q({ "where[or][0][title][like]": term, "where[or][1][sku][like]": term, "where[or][2][model][like]": term, limit: "5", depth: "1" })}`),
    getJson<Docs>(`${API}/users?${q({ ...userWhere, limit: "5", depth: "0" })}`),
  ]);
  const out: Result[] = [];
  for (const o of orders?.docs ?? []) {
    const c = (o.customer ?? {}) as Record<string, string>;
    const total = Number(o.total) || 0;
    const amount = typeof o.currency === "string" && o.currency && o.currency !== money.currency ? formatMoney(total, { currency: o.currency, locale: money.locale }) : money(total);
    out.push({ group: "Orders", title: `#${String(o.orderNumber).slice(-4)} · ${c.name ?? ""}`, sub: `${String(o.orderNumber)} · ${c.phone ?? ""} · ${amount}`, href: `${ADMIN}/collections/orders/${o.id}` });
  }
  for (const p of products?.docs ?? []) {
    const img = Array.isArray(p.images) ? (p.images[0] as { thumbnailURL?: string; url?: string } | undefined) : undefined;
    out.push({ group: "Products", title: String(p.title), sub: `${String(p.sku ?? "")} · ${money(Number(p.price) || 0)} · ${Number(p.stock) || 0} in stock`, href: `${ADMIN}/collections/products/${p.id}`, thumb: img?.thumbnailURL ?? img?.url });
  }
  for (const u of users?.docs ?? []) {
    out.push({ group: "Customers", title: String(u.name || u.email), sub: [u.email, u.phone].filter(Boolean).join(" · "), href: `${ADMIN}/collections/users/${u.id}` });
  }
  return out;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const money = useAdminMoney();

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      search(t, money).then((r) => {
        setResults(r);
        setCursor(0);
        setBusy(false);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [term, money]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };
  const groups = (["Orders", "Products", "Customers"] as const).map((g) => ({ g, items: results.filter((r) => r.group === g) })).filter((x) => x.items.length);

  return (
    <div className="urko-dialog__backdrop" onClick={onClose}>
      <div className="urko-dialog urko-search" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <label className="urko-search__field">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, results.length - 1));
              if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
              if (e.key === "Enter") go(results[cursor]);
            }}
            placeholder="Order number, phone, product, SKU or customer"
            aria-label="Search orders, products and customers"
          />
          <button type="button" className="urko-icon-btn" onClick={onClose} aria-label="Close search">
            <Icon name="close" />
          </button>
        </label>
        <div className="urko-search__results" aria-live="polite">
          {term.trim().length < 2 && <p className="urko-muted">Type at least 2 letters or the last digits of a phone number.</p>}
          {busy && <p className="urko-muted">Searching…</p>}
          {!busy && term.trim().length >= 2 && !results.length && <p className="urko-muted">Nothing found for “{term.trim()}”.</p>}
          {groups.map(({ g, items }) => (
            <section key={g}>
              <h3 className="urko-search__group">{g}</h3>
              <ul>
                {items.map((r) => {
                  const i = results.indexOf(r);
                  return (
                    <li key={r.href}>
                      <Link href={r.href} onClick={onClose} className={`urko-search__item${i === cursor ? " is-active" : ""}`} onMouseEnter={() => setCursor(i)}>
                        {r.group === "Products" ? (
                          r.thumb ? <img src={r.thumb} alt="" width={36} height={36} className="urko-thumb" /> : <span className="urko-thumb" aria-hidden="true" />
                        ) : null}
                        <span>
                          <strong>{r.title}</strong>
                          <span className="urko-muted">{r.sub}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function useTodo() {
  const [todo, setTodo] = useState<Todo | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    getJson<{ todo: Todo }>(`${API}/reports`).then((r) => r && setTodo(r.todo));
  }, [pathname]);
  return todo;
}

export function TopActions() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<"add" | "bell" | null>(null);
  const { setNavOpen } = useNav();
  const todo = useTodo();
  const pathname = usePathname() ?? "";

  const openSearch = useCallback(() => {
    setMenu(null);
    setSearchOpen(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);
  useEffect(() => setMenu(null), [pathname]);

  const alerts = useMemo(() => {
    if (!todo) return [];
    return [
      { n: todo.pendingOrders, text: "orders to confirm", href: `${ADMIN}/collections/orders?where%5Bstatus%5D%5Bequals%5D=pending` },
      { n: todo.paymentsToVerify, text: "payments to verify", href: `${ADMIN}/collections/orders?where%5BpaymentStatus%5D%5Bequals%5D=awaiting-verification` },
      { n: todo.lowStockTotal + todo.outOfStockTotal, text: "products low or out of stock", href: `${ADMIN}/collections/products?where%5BstockStatus%5D%5Bin%5D%5B0%5D=low&where%5BstockStatus%5D%5Bin%5D%5B1%5D=out` },
      { n: todo.newWholesale, text: "new wholesale enquiries", href: `${ADMIN}/collections/wholesale-inquiries?where%5Bstatus%5D%5Bequals%5D=new` },
      { n: todo.openMessages, text: "unread messages", href: `${ADMIN}/collections/contact-messages` },
    ].filter((a) => a.n > 0);
  }, [todo]);
  const alertCount = alerts.reduce((s, a) => s + a.n, 0);

  const isActive = (href: string, exact = false) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <div className="urko-actions">
        <button type="button" className="urko-searchbtn" onClick={openSearch} aria-label="Search orders, products and customers (Ctrl K)">
          <Icon name="search" />
          <span className="urko-searchbtn__text">Search orders, phones, products…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="urko-menu-wrap">
          <button type="button" className="btn btn--style-primary btn--size-small urko-addbtn" aria-haspopup="menu" aria-expanded={menu === "add"} onClick={() => setMenu(menu === "add" ? null : "add")}>
            <Icon name="plus" strokeWidth={2.6} />
            <span>Add</span>
          </button>
          {menu === "add" && (
            <div className="urko-menu" role="menu">
              <Link role="menuitem" href={`${ADMIN}/collections/products/create`}>Add product</Link>
              <Link role="menuitem" href={`${ADMIN}/collections/orders/create`}>Create order</Link>
              <Link role="menuitem" href={`${ADMIN}/collections/users/create`}>Add customer</Link>
              <Link role="menuitem" href={`${ADMIN}/collections/discounts/create`}>Add discount code</Link>
            </div>
          )}
        </div>
        <div className="urko-menu-wrap">
          <button type="button" className="urko-icon-btn" aria-haspopup="menu" aria-expanded={menu === "bell"} onClick={() => setMenu(menu === "bell" ? null : "bell")} aria-label={alertCount ? `Notifications: ${alertCount} things need attention` : "Notifications: nothing new"}>
            <Icon name="bell" />
            {alertCount > 0 && <span className="urko-dot" aria-hidden="true" />}
          </button>
          {menu === "bell" && (
            <div className="urko-menu urko-menu--wide" role="menu">
              {alerts.length ? (
                alerts.map((a) => (
                  <Link role="menuitem" key={a.text} href={a.href}>
                    <strong>{a.n}</strong> {a.text}
                  </Link>
                ))
              ) : (
                <p className="urko-muted" style={{ margin: 0, padding: "10px 12px" }}>
                  All caught up – nothing needs your attention.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="urko-tabbar" aria-label="Quick menu">
        <Link href={ADMIN} className={isActive(ADMIN, true) ? "is-active" : ""} aria-current={isActive(ADMIN, true) ? "page" : undefined}>
          <Icon name="home" size={22} />
          Home
        </Link>
        <Link href={`${ADMIN}/collections/orders`} className={isActive(`${ADMIN}/collections/orders`) ? "is-active" : ""}>
          <Icon name="orders" size={22} />
          Orders
          {todo?.pendingOrders ? <span className="urko-tabbar__badge">{todo.pendingOrders}</span> : null}
        </Link>
        <Link href={`${ADMIN}/collections/products`} className={isActive(`${ADMIN}/collections/products`) ? "is-active" : ""}>
          <Icon name="products" size={22} />
          Products
        </Link>
        <button type="button" onClick={openSearch}>
          <Icon name="search" size={22} />
          Search
        </button>
        <button type="button" onClick={() => setNavOpen(true)}>
          <Icon name="more" size={22} strokeWidth={3} />
          More
        </button>
      </nav>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
