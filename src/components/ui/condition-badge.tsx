import type { Condition } from "@/lib/types";
import { cn, conditionMeta } from "@/lib/utils";

const TONES: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 light:text-emerald-700",
  sky: "bg-sky-500/15 text-sky-400 border-sky-500/30 light:text-sky-700",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30 light:text-amber-700",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30 light:text-violet-700",
  teal: "bg-teal-500/15 text-teal-400 border-teal-500/30 light:text-teal-700",
};

export function ConditionBadge({ condition, long, className }: { condition: Condition; long?: boolean; className?: string }) {
  const m = conditionMeta[condition];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur",
        TONES[m.tone],
        className
      )}
    >
      {long ? m.label : m.short}
    </span>
  );
}
