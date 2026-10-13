"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { createAccountFromOrder, type CreateAccountResult } from "@/app/(frontend)/(store)/order-confirmation/actions";

/** Thank-you page: one click to turn this order's customer record into an account (password set from an emailed link). */
export function CreateAccountCard({ orderNumber, email }: { orderNumber: string; email: string }) {
  const [result, setResult] = useState<CreateAccountResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card mx-auto mt-6 flex max-w-3xl flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="oc-account">
      <div>
        <h2 id="oc-account" className="font-display text-lg font-bold">
          Save your details for next time
        </h2>
        <p className="mt-1 text-sm text-muted">
          Create an account with <span className="font-semibold text-fg">{email}</span> to track this order, download invoices and check out faster. No form to fill – we email you a link to choose a password.
        </p>
        {result && (
          <p className={`mt-2 text-sm ${result.ok ? "text-emerald-300" : "text-rose-300"}`} role="status">
            {result.ok && <CheckCircle2 className="mr-1 inline size-4" aria-hidden="true" />}
            {result.message}{" "}
            {result.signIn && (
              <Link href={`/account/login?next=${encodeURIComponent(`/account/orders/${orderNumber}`)}`} className="font-semibold text-violet-300 underline">
                Sign in
              </Link>
            )}
            {result.register && (
              <Link href="/account/register" className="font-semibold text-violet-300 underline">
                Create an account
              </Link>
            )}
          </p>
        )}
      </div>
      {!result?.ok && !result?.register && (
        <button type="button" className="btn btn-primary shrink-0" disabled={pending} onClick={() => start(async () => setResult(await createAccountFromOrder(orderNumber).catch(() => ({ ok: false, message: "Something went wrong – please try again." }))))}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          Create my account
        </button>
      )}
    </section>
  );
}
