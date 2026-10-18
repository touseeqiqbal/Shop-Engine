import { Gift, Sparkles } from "lucide-react";
import type { LoyaltySummary } from "@/lib/cms/loyalty";
import { pointsToVoucherAction } from "@/app/(frontend)/(store)/account/loyalty-actions";

/** The customer's loyalty points in this store and their vouchers (account page). Server component. */
export function LoyaltyCard({ summary, money, note }: { summary: LoyaltySummary; money: (n: number) => string; note?: string | null }) {
  const { balance, worth, settings, vouchers } = summary;
  const canRedeem = balance >= settings.minRedeem && worth > 0;
  return (
    <section id="loyalty" className="card p-5 sm:p-6" aria-labelledby="loyalty-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="loyalty-title" className="flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="size-5 text-violet-300" aria-hidden="true" /> Loyalty points
          </h2>
          <p className="mt-1 text-sm text-muted">
            You get {settings.pointsPer100} point{settings.pointsPer100 === 1 ? "" : "s"} for every {money(100)} you spend, once your order is delivered.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-extrabold tabular-nums">{balance}</p>
          <p className="text-xs text-muted">points · worth {money(worth)}</p>
        </div>
      </div>
      {note && (
        <p role="status" className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm">
          {note}
        </p>
      )}
      <form action={pointsToVoucherAction} className="mt-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!canRedeem}>
          <Gift className="size-4" aria-hidden="true" /> Turn my points into a {money(worth)} voucher
        </button>
        {!canRedeem && <p className="mt-2 text-xs text-muted">Vouchers start at {settings.minRedeem} points.</p>}
      </form>
      {vouchers.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Your vouchers</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {vouchers.map((v) => (
              <li key={v.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="select-all font-mono font-semibold">{v.code}</span>
                <span className="text-muted">
                  {money(v.balance)} left{v.balance < v.value ? ` of ${money(v.value)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Enter the code in “Gift card” at checkout.</p>
        </div>
      )}
    </section>
  );
}
