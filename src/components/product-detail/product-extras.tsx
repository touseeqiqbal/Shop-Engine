"use client";
import { startTransition, useActionState, useState } from "react";
import { BellRing, MessageCircleQuestion, TrendingDown } from "lucide-react";
import { askQuestion, subscribeAlert, type SimpleState } from "@/app/(frontend)/(store)/[category]/[product]/engagement-actions";
import { Turnstile } from "@/components/ui/turnstile";
import { useMoney, useStoreLocale } from "@/components/providers/locale";
import { currencyDigits } from "@/lib/money";
import { phonePlaceholder } from "@/lib/phone";
import { honeypotProps } from "@/lib/honeypot";

/** Product page extras: back-in-stock / price-drop alert, installments block, questions & answers. */

/** onSubmit: send in a transition so React doesn't empty what was typed on an error (`action` stays for no-JavaScript). */
const keepTyped = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => action(fd));
};

export function StockPriceAlert({ productId, inStock }: { productId: string; inStock: boolean }) {
  const kind = inStock ? "price" : "stock";
  const [open, setOpen] = useState(!inStock);
  const [state, action, pending] = useActionState<SimpleState, FormData>(subscribeAlert.bind(null, productId, kind), {});
  const { country } = useStoreLocale();
  if (state.ok) return <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 light:text-emerald-700">{state.message}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <TrendingDown className="size-4" aria-hidden="true" /> Tell me if the price drops
      </button>
    );
  return (
    <form action={action} onSubmit={keepTyped(action)} className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4 text-violet-300" aria-hidden="true" />
        {inStock ? "Tell me if the price drops" : "Out of stock – tell me when it's back"}
      </p>
      <input className="hidden" {...honeypotProps} />
      <div className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`alert-${productId}`}>
          Email or mobile number
        </label>
        <input id={`alert-${productId}`} name="contact" className="input flex-1" placeholder={`Email or ${country === "PK" ? "0300-1234567" : phonePlaceholder(country)}`} required />
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "…" : "Notify me"}
        </button>
      </div>
      {state.message && <p className="mt-2 text-sm text-rose-300 light:text-rose-700">{state.message}</p>}
    </form>
  );
}

export type EmiProps = { price: number; heading: string; note: string; plans: { bank: string; months: number; markupPercent: number; minAmount: number }[] };

export function EmiBlock({ price, heading, note, plans }: EmiProps) {
  const money = useMoney();
  const rows = plans.filter((p) => !p.minAmount || price >= p.minAmount);
  if (!rows.length) return null;
  // instalments round UP to the currency's smallest unit (whole rupees, cents …) so they cover the price
  const minor = 10 ** currencyDigits(money.currency);
  const perMonth = (p: EmiProps["plans"][number]) => Math.ceil(((price * (1 + p.markupPercent / 100)) / p.months) * minor) / minor;
  const cheapest = Math.min(...rows.map(perMonth));
  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        {heading} – from <span className="text-fg">{money(cheapest)}/month</span>
      </summary>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-medium">Bank</th>
            <th className="py-1 font-medium">Months</th>
            <th className="py-1 text-right font-medium">Per month</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.bank}-${p.months}`} className="border-t border-border">
              <td className="py-1.5">{p.bank}</td>
              <td className="py-1.5">{p.months}</td>
              <td className="py-1.5 text-right tabular-nums">{money(perMonth(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-subtle">{note}</p>
    </details>
  );
}

export type QA = { id: string; name: string; question: string; answer: string; createdAt: string };

export function ProductQuestions({ productId, questions }: { productId: string; questions: QA[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SimpleState, FormData>(askQuestion.bind(null, productId), {});
  return (
    <div className="space-y-4">
      {questions.length ? (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="card p-4">
              <p className="font-semibold">Q: {q.question}</p>
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-semibold text-fg">A:</span> {q.answer}
              </p>
              <p className="mt-1 text-xs text-subtle">Asked by {q.name || "a customer"}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No questions yet – ask the first one.</p>
      )}
      {state.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 light:text-emerald-700">{state.message}</p>
      ) : !open ? (
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          <MessageCircleQuestion className="size-4" aria-hidden="true" /> Ask a question
        </button>
      ) : (
        <form action={action} onSubmit={keepTyped(action)} className="card space-y-3 p-4">
          <input className="hidden" {...honeypotProps} />
          <label className="block text-sm font-medium">
            Your question
            <textarea name="question" rows={3} className="input mt-1" required minLength={8} maxLength={800} placeholder="e.g. Does it support a second SSD?" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Name
              <input name="name" className="input mt-1" required minLength={2} />
            </label>
            <label className="block text-sm font-medium">
              Email <span className="text-subtle">(optional – we&apos;ll tell you when it&apos;s answered)</span>
              <input name="email" type="email" className="input mt-1" />
            </label>
          </div>
          <Turnstile action="question" />
          {state.message && <p className="text-sm text-rose-300 light:text-rose-700">{state.message}</p>}
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send question"}
          </button>
        </form>
      )}
    </div>
  );
}
