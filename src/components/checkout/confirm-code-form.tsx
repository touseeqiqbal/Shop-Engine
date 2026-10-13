"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { confirmByCode, type CodeState } from "@/app/(frontend)/(store)/confirm-order/actions";

/** Thank-you page: "Enter the 6-digit code we sent to your phone" (fake-order protection). */
export function ConfirmCodeForm({ orderNumber, phone, deadline }: { orderNumber: string; phone: string; deadline: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(confirmByCode.bind(null, orderNumber), {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
      <p className="font-semibold text-amber-200">One more step: confirm your order</p>
      <p className="mt-1 text-sm text-muted">
        We sent a link and a 6-digit code to <strong className="text-fg">{phone}</strong>. Tap the link, or type the code here. Not confirmed by {deadline} = cancelled.
      </p>
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="confirm-code">
          6-digit code
        </label>
        <input id="confirm-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required placeholder="123456" className="input flex-1 font-mono tracking-[0.3em]" />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Checking…" : "Confirm"}
        </button>
      </div>
      {state.message && (
        <p role="status" className={`mt-2 text-sm ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
