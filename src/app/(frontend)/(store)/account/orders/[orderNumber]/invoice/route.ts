import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { getSiteInfo } from "@/lib/repo/site-content";
import { localeOfStore } from "@/lib/store-locale";
import { ORDER_NUMBER_RE } from "@/lib/order-number";
import { loadViewableOrder } from "../../load";

export const dynamic = "force-dynamic";

/** GET /account/orders/<number>/invoice – the order's invoice as a PDF (its customer, or the device that placed it). */
export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  let n = "";
  try {
    n = decodeURIComponent(orderNumber).toUpperCase();
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!ORDER_NUMBER_RE.test(n)) return new Response("Not found", { status: 404 });
  const found = await loadViewableOrder(n);
  if (!found) return new Response("Please sign in to download this invoice.", { status: 401, headers: { "Cache-Control": "no-store" } });
  // amounts and dates as the order's store shows them (its currency and time zone)
  const pdf = await buildInvoicePdf(found.order, await getSiteInfo(), await localeOfStore(found.order.storeId));
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${n}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
