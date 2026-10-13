import type { Metadata } from "next";
import Link from "next/link";
import { findDraftByToken, stopDraftReminders } from "@/lib/cms/engagement";
import { RestoreCart, type RestoreLine } from "@/components/checkout/restore-cart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

/** Link from a cart reminder: puts the saved items back in the cart and opens checkout. ?stop=1 → no more reminders. */
export default async function RestoreCartPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ stop?: string }> }) {
  const [{ token }, { stop }] = await Promise.all([params, searchParams]);
  if (stop) {
    await stopDraftReminders(token).catch(() => undefined);
    return (
      <div className="container-x py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-bold">No more reminders</h1>
          <p className="mt-2 text-muted">We won&apos;t remind you about this cart again.</p>
          <Link href="/" className="btn btn-primary mt-6">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }
  const draft = await findDraftByToken(token).catch(() => null);
  const items = (Array.isArray(draft?.items) ? draft.items : []) as Record<string, unknown>[];
  const lines: RestoreLine[] = items.map((i) => ({
    productId: String(i.productId ?? ""),
    name: String(i.name ?? ""),
    qty: Number(i.qty) || 1,
    unitPrice: Number(i.unitPrice) || 0,
    slug: String(i.slug ?? ""),
    url: String(i.url ?? "/"),
    image: String(i.image ?? ""),
    brandName: String(i.brandName ?? ""),
  }));
  return <RestoreCart lines={draft && draft.status !== "stopped" ? lines : []} />;
}
