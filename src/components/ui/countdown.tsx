"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ endsAt, className, compact }: { endsAt: string; className?: string; compact?: boolean }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now != null && end <= now) return <span className={cn("text-sm text-muted", className)}>Deal ended</span>;
  const p = parts(now == null ? 0 : end - now);
  const units: [string, number][] = [
    ["Days", p.d],
    ["Hrs", p.h],
    ["Min", p.m],
    ["Sec", p.s],
  ];
  return (
    <div className={cn("flex items-center gap-1.5", className)} role="timer" aria-label="Time left in deal">
      {units.map(([label, v], i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={cn("glass rounded-xl text-center tabular-nums", compact ? "min-w-[2.4rem] px-2 py-1" : "min-w-[3.1rem] px-2.5 py-1.5")}>
            <div className={cn("font-display font-bold text-fg", compact ? "text-sm" : "text-lg")}>
              {now == null ? "--" : String(v).padStart(2, "0")}
            </div>
            {!compact && <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>}
          </div>
          {i < 3 && <span className="font-bold text-muted">:</span>}
        </div>
      ))}
    </div>
  );
}
