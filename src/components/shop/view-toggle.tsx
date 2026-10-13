"use client";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListing } from "./listing-context";

/** Grid / list switch persisted as `view=list` in the URL. */
export function ViewToggle({ className }: { className?: string }) {
  const { params, update } = useListing();
  const view = params.get("view") === "list" ? "list" : "grid";
  const set = (v: "grid" | "list") => update((p) => (v === "list" ? p.set("view", "list") : p.delete("view")), { keepPage: true, replace: true });
  const opts = [
    { v: "grid" as const, Icon: LayoutGrid, label: "Grid view" },
    { v: "list" as const, Icon: List, label: "List view" },
  ];
  return (
    <div role="group" aria-label="Layout" className={cn("inline-flex rounded-full border border-border bg-surface p-1", className)}>
      {opts.map(({ v, Icon, label }) => (
        <button
          key={v}
          type="button"
          aria-label={label}
          aria-pressed={view === v}
          onClick={() => set(v)}
          className={cn(
            "grid size-8 place-items-center rounded-full transition-colors",
            view === v ? "bg-brand-gradient text-white shadow" : "text-muted hover:text-fg"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
