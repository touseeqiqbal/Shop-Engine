import type { Metadata } from "next";
import { Clock, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TrackOrderForm } from "@/components/checkout/track-order-form";
import { getPageMeta } from "@/lib/page-seo";
import { getSiteInfo } from "@/lib/repo/site-content";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMeta("/track-order");
}

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  const { order } = await searchParams;
  const initial = (Array.isArray(order) ? order[0] : order)?.slice(0, 20) ?? "";
  const site = await getSiteInfo(); // live business profile (/cms → Settings → Store details)
  return (
    <div className="container-x pb-14 pt-4 sm:pt-6">
      <Breadcrumbs items={[{ name: "Track Order", href: "/track-order" }]} />
      <div className="mx-auto mt-6 max-w-5xl">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-gradient text-white">
            <PackageSearch className="size-7" aria-hidden="true" />
          </span>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Track your <span className="gradient-text">order</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Enter your order number (e.g. UTS-260512-482193) and the mobile number you used at checkout to see live status and courier tracking.
          </p>
        </div>
        <TrackOrderForm initialOrder={initial} />
        <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
          <li className="card flex items-start gap-3 p-4">
            <Truck className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden="true" />
            <span>
              <strong className="block">Nationwide delivery</strong>
              <span className="text-muted">{site.couriers.join(", ")}</span>
            </span>
          </li>
          <li className="card flex items-start gap-3 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden="true" />
            <span>
              <strong className="block">Delivery times</strong>
              <span className="text-muted">Karachi same/next day · major cities 1–3 days · others 3–5 days</span>
            </span>
          </li>
          <li className="card flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden="true" />
            <span>
              <strong className="block">Need help?</strong>
              <span className="text-muted">WhatsApp {site.phones[0]?.display} with your order number</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
