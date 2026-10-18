"use client";
import { useId, useState } from "react";
import { Gift, Loader2, X } from "lucide-react";
import { checkGiftCard } from "@/app/(frontend)/(store)/checkout/actions";
import { useMoney } from "@/components/providers/locale";
import { cn } from "@/lib/utils";

export type AppliedGiftCard = { code: string; balance: number };

/** Gift card code at checkout: checks the balance with the server, then the form shows what it pays. */
export function GiftCardBox({
  id: idProp,
  applied,
  used,
  error,
  onApply,
  onRemove,
  className,
}: {
  /** id of the code box (or the Remove button once applied), so the form can move the focus here on an error */
  id?: string;
  applied: AppliedGiftCard | null;
  /** what it pays of this order */
  used: number;
  /** from the server when the order was placed (balance changed meanwhile …) */
  error?: string;
  onApply: (card: AppliedGiftCard) => void;
  onRemove: () => void;
  className?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const money = useMoney();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  if (applied) {
    return (
      <div className={cn("rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3", className)}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
            <Gift className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="min-w-0">
              <span className="font-medium text-emerald-300">Gift card ••••{applied.code.slice(-4)}</span>{" "}
              <span className="text-muted">
                pays {money(used)}
                {applied.balance > used ? ` · ${money(applied.balance - used)} stays on the card` : ""}
              </span>
            </span>
          </p>
          <button id={id} type="button" onClick={onRemove} className="btn btn-ghost btn-sm shrink-0" aria-label="Remove the gift card" aria-describedby={error ? `${id}-msg` : undefined}>
            <X className="size-4" aria-hidden="true" /> Remove
          </button>
        </div>
        {error && (
          <p id={`${id}-msg`} className="mt-1.5 text-xs font-medium text-rose-400 light:text-rose-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  const submit = async () => {
    if (!code.trim() || checking) return;
    setChecking(true);
    setMessage("");
    try {
      const res = await checkGiftCard(code);
      if (res.ok) {
        onApply({ code: res.code, balance: res.balance });
        setCode("");
      } else setMessage(res.message);
    } catch {
      setMessage("We couldn't check the gift card – please try again.");
    } finally {
      setChecking(false);
    }
  };

  const shown = message || error || "";
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        Gift card
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="input font-mono uppercase placeholder:font-sans placeholder:normal-case"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={code}
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          aria-invalid={Boolean(shown)}
          aria-describedby={`${id}-msg`}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={submit} disabled={checking || !code.trim()}>
          {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Apply
        </button>
      </div>
      <p id={`${id}-msg`} aria-live="polite" className={cn("mt-1.5 min-h-4 text-xs", shown ? "text-rose-400 light:text-rose-700" : "text-muted")}>
        {shown}
      </p>
    </div>
  );
}
