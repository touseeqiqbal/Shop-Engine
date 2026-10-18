"use server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isCmsConfigured } from "@/lib/db/config";
import { rateLimit } from "@/lib/rate-limit";
import { currentStoreId } from "@/lib/tenant";
import { log } from "@/lib/log";

/** "Turn my points into a voucher" on the account page – all of the customer's points in this store, at once. */
export async function pointsToVoucherAction(): Promise<void> {
  const user = await getSessionUser().catch(() => null);
  if (!user || !isCmsConfigured) redirect("/account/login?next=/account");
  if (!(await rateLimit("points-voucher", 5, 10 * 60_000))) redirect("/account?voucher=wait");
  let to = "/account?voucher=failed";
  try {
    const { pointsToVoucher } = await import("@/lib/cms/loyalty");
    const r = await pointsToVoucher({ id: Number(user.id), email: user.email, name: user.name }, await currentStoreId());
    to = `/account?voucher=${r.ok ? "made" : r.reason}#loyalty`;
  } catch (e) {
    log.error("loyalty.voucher_failed", e);
  }
  redirect(to);
}
