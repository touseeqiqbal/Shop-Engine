"use client";
import { useId, useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useCartCoupon } from "./use-coupon";

/** Coupon code input bound to useCartCoupon(). */
export function CouponBox({ coupon, className }: { coupon: ReturnType<typeof useCartCoupon>; className?: string }) {
  const id = useId();
  const [code, setCode] = useState("");
  const checking = coupon.status === "checking";

  if (coupon.code && coupon.status !== "error") {
    return (
      <div className={cn("flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3", className)}>
        <p className="flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
          <Tag className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="truncate">
            {checking ? (
              <>Checking <strong>{coupon.code}</strong>…</>
            ) : (
              <span className="font-medium text-emerald-300">{coupon.message || `${coupon.code} applied`}</span>
            )}
          </span>
        </p>
        <button type="button" onClick={coupon.remove} className="btn btn-ghost btn-sm shrink-0" aria-label={`Remove coupon ${coupon.code}`}>
          <X className="size-4" aria-hidden="true" /> Remove
        </button>
      </div>
    );
  }

  const submit = async () => {
    if (!code.trim()) return;
    const res = await coupon.apply(code);
    if (res?.ok) setCode("");
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input uppercase placeholder:normal-case"
          placeholder="e.g. WELCOME5"
          value={code}
          autoComplete="off"
          maxLength={40}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          aria-describedby={`${id}-msg`}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={submit} disabled={checking || !code.trim()}>
          {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Apply
        </button>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={cn("mt-1.5 min-h-4 text-xs", coupon.status === "error" ? "text-rose-400" : "text-muted")}>
        {coupon.status === "error" ? coupon.message : ""}
      </p>
    </div>
  );
}
