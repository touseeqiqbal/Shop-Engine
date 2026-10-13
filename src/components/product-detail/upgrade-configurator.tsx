"use client";
import { m as motion } from "framer-motion";
import { Check, Cpu, HardDrive, MemoryStick, Sparkles } from "lucide-react";
import type { UpgradeOption } from "@/lib/types";
import { cn, formatPKR } from "@/lib/utils";

const GROUP_ICON: Record<string, typeof Cpu> = { RAM: MemoryStick, SSD: HardDrive, Storage: HardDrive };

export function groupUpgrades(upgrades: UpgradeOption[]) {
  const map = new Map<string, UpgradeOption[]>();
  for (const u of upgrades) map.set(u.group, [...(map.get(u.group) ?? []), u]);
  return [...map.entries()];
}

/** One radio group per upgrade group (RAM, SSD…), each with a "Keep standard" option. */
export function UpgradeConfigurator({
  upgrades,
  selected,
  onChange,
  idPrefix,
}: {
  upgrades: UpgradeOption[];
  selected: Record<string, string | null>;
  onChange: (group: string, id: string | null) => void;
  idPrefix: string;
}) {
  const groups = groupUpgrades(upgrades);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-brand-gradient text-white">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">Customise your laptop</p>
          <p className="text-xs text-muted">Free installation · genuine parts · upgrade warranty included</p>
        </div>
      </div>
      {groups.map(([group, options]) => {
        const Icon = GROUP_ICON[group] ?? Cpu;
        const name = `${idPrefix}-${group}`;
        const choices: (UpgradeOption | null)[] = [null, ...options];
        return (
          <fieldset key={group}>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <Icon className="size-3.5" aria-hidden="true" /> {group}
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {choices.map((opt) => {
                const id = opt?.id ?? null;
                const checked = (selected[group] ?? null) === id;
                return (
                  <label
                    key={id ?? "standard"}
                    className={cn(
                      "relative flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500",
                      checked
                        ? "border-violet-500/70 bg-violet-500/10 shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)]"
                        : "border-border bg-surface hover:border-border-strong"
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={id ?? ""}
                      checked={checked}
                      onChange={() => onChange(group, id)}
                      className="sr-only"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg">{opt ? opt.label : "Keep standard"}</span>
                      <span className={cn("block text-xs", opt ? "text-violet-300 light:text-violet-700" : "text-muted")}>
                        {opt ? `+ ${formatPKR(opt.price)}` : "Included"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border transition",
                        checked ? "border-transparent bg-brand-gradient text-white" : "border-border-strong"
                      )}
                      aria-hidden="true"
                    >
                      {checked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check className="size-3" strokeWidth={3} />
                        </motion.span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
