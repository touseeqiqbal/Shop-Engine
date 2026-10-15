"use client";
import { m as motion } from "framer-motion";
import { Truck } from "lucide-react";
import { useMoney } from "@/components/providers/locale";
import { cn } from "@/lib/utils";

/** Progress to free delivery. `where`: the chosen city (the threshold is that city's zone rule), else the store-wide rule. */
export function FreeDeliveryBar({ subtotal, threshold, where, className }: { subtotal: number; threshold: number; where?: string | null; className?: string }) {
  const money = useMoney();
  const remaining = Math.max(0, threshold - subtotal);
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100;
  return (
    <div className={className}>
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        <Truck className={cn("size-4 shrink-0", remaining ? "text-violet-300" : "text-emerald-400")} aria-hidden="true" />
        {remaining > 0 ? (
          <span>
            Add <strong>{money(remaining)}</strong> more for <strong className="text-emerald-400">FREE delivery</strong>
            {where ? ` to ${where}` : ""}
          </span>
        ) : (
          <span className="font-semibold text-emerald-400">You&apos;ve unlocked FREE delivery{where ? ` to ${where}` : ""}!</span>
        )}
      </p>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-strong"
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div className="h-full rounded-full bg-brand-gradient" initial={false} animate={{ width: `${progress}%` }} transition={{ type: "spring", damping: 25 }} />
      </div>
    </div>
  );
}
