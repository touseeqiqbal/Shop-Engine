import { NextResponse } from "next/server";
import { stopDraftReminders } from "@/lib/cms/engagement";
import { isCmsConfigured } from "@/lib/db/config";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

/**
 * One-click unsubscribe from cart reminders (RFC 8058): the email app's own "Unsubscribe" button POSTs here
 * (List-Unsubscribe / List-Unsubscribe-Post headers on the reminder). Stops this cart's reminders and puts the
 * shopper on the store's Unsubscribed list. Opening the address in a browser shows the confirm page instead –
 * link scanners that only GET never unsubscribe anyone.
 */
type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { token } = await params;
  if (isCmsConfigured && (await rateLimit("unsubscribe", 30, 60_000))) {
    try {
      await stopDraftReminders(token, undefined, "one-click");
    } catch (e) {
      log.error("unsubscribe.failed", e);
    }
  }
  // the same answer whether or not the cart exists (nothing to learn about other people's carts)
  return new NextResponse("Unsubscribed – you won't get these reminders again.", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/cart/restore/${encodeURIComponent(token)}?stop=1`, req.url), 303);
}
