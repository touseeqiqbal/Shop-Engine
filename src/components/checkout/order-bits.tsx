"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { m as motion } from "framer-motion";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Submit button of a server-action form that shows it's working ("Opening payment page…") so it isn't tapped twice. */
export function PendingSubmit({ children, pendingLabel, className }: { children: React.ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Animated success check with confetti-ish burst. */
export function SuccessBadge() {
  const dots = Array.from({ length: 12 });
  return (
    <div className="relative mx-auto grid size-28 place-items-center" aria-hidden="true">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className={cn("absolute size-2 rounded-full", i % 3 === 0 ? "bg-cyan-400" : i % 3 === 1 ? "bg-blue-500" : "bg-violet-500")}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: Math.cos(angle) * 64, y: Math.sin(angle) * 64, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
            transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
          />
        );
      })}
      <motion.div
        className="absolute inset-2 rounded-full bg-brand-gradient opacity-30 blur-xl"
        initial={{ scale: 0.6 }}
        animate={{ scale: [0.6, 1.15, 1] }}
        transition={{ duration: 0.9 }}
      />
      <motion.div
        className="relative grid size-24 place-items-center rounded-full bg-brand-gradient shadow-2xl"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <svg viewBox="0 0 24 24" className="size-12 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.3 }} />
        </svg>
      </motion.div>
    </div>
  );
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  // clipboard blocked (older browser, no permission): say so, so the shopper copies it by hand
  const text = status === "copied" ? "Copied" : status === "failed" ? "Couldn't copy – select the number" : label;
  return (
    <button
      type="button"
      className={cn("btn btn-secondary btn-sm", className)}
      onClick={async () => {
        let ok = false;
        try {
          await navigator.clipboard.writeText(value);
          ok = true;
        } catch {}
        setStatus(ok ? "copied" : "failed");
        setTimeout(() => setStatus("idle"), ok ? 1800 : 4000);
      }}
      aria-label={status === "idle" ? `${label} ${value}` : text}
    >
      {status === "copied" ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}
