import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { WhatsAppLink } from "@/components/content/whatsapp-link";

export default function ProductNotFound() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="card relative max-w-xl overflow-hidden p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
        <span className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-brand-gradient text-white">
          <PackageSearch className="size-8" aria-hidden="true" />
        </span>
        <h1 className="relative mt-6 font-display text-2xl font-bold text-fg sm:text-3xl">This product isn&apos;t available</h1>
        <p className="relative mt-3 text-muted">
          It may have sold out or moved. Search our catalogue, or message us on WhatsApp – we can often source it for you.
        </p>
        <div className="relative mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link href="/shop" className="btn btn-primary">
            <Search className="size-4" aria-hidden="true" /> Browse the shop
          </Link>
          <WhatsAppLink message="Hi! I'm looking for a product I couldn't find on your website:" className="btn btn-whatsapp">
            <WhatsAppIcon className="size-4" /> Ask on WhatsApp
          </WhatsAppLink>
        </div>
      </div>
    </div>
  );
}
