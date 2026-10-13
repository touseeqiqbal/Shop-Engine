"use client";
import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { PAKISTAN_CITIES, MAJOR_CITIES } from "@/lib/cities";
import { cn } from "@/lib/utils";

/**
 * Accessible searchable city picker (WAI-ARIA 1.2 combobox + listbox).
 * Keyboard: ↑/↓ move, Enter select, Esc close, Home/End jump, Tab commits the highlighted city.
 */
export function CityCombobox({
  value,
  onChange,
  name = "city",
  label = "City",
  error,
  required,
  id: idProp,
  className,
  placeholder = "Search your city…",
}: {
  value: string;
  onChange: (city: string) => void;
  name?: string;
  label?: string;
  error?: string;
  required?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const autoId = useId();
  const id = idProp ?? `city-${autoId}`;
  const listId = `${id}-list`;
  const errId = `${id}-error`;
  const [query, setQuery] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    // value changed from outside (e.g. a saved address was picked)
    setSynced(value);
    setQuery(value);
  }
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === value.toLowerCase()) {
      // popular cities first when nothing typed
      const major = MAJOR_CITIES as readonly string[];
      return [...major, ...PAKISTAN_CITIES.filter((c) => !major.includes(c))];
    }
    const starts = PAKISTAN_CITIES.filter((c) => c.toLowerCase().startsWith(q));
    const contains = PAKISTAN_CITIES.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [query, value]);

  const scrollTo = (i: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    el?.scrollIntoView({ block: "nearest" });
  };
  const move = (i: number) => {
    const next = Math.max(0, Math.min(options.length - 1, i));
    setActive(next);
    requestAnimationFrame(() => scrollTo(next));
  };
  const select = (city: string) => {
    onChange(city);
    setQuery(city);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          move(Math.max(0, options.indexOf(value)));
        } else move(active + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        move(active - 1);
        break;
      case "Home":
        if (open) { e.preventDefault(); move(0); }
        break;
      case "End":
        if (open) { e.preventDefault(); move(options.length - 1); }
        break;
      case "Enter":
        if (open && options[active]) {
          e.preventDefault();
          select(options[active]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setQuery(value);
        }
        break;
      case "Tab":
        if (open && query.trim() && options[active] && query !== value) select(options[active]);
        else setOpen(false);
        break;
    }
  };

  const onBlur = () => {
    // Defer so a click on an option registers first
    setTimeout(() => {
      setOpen(false);
      const exact = PAKISTAN_CITIES.find((c) => c.toLowerCase() === query.trim().toLowerCase());
      if (exact) {
        if (exact !== value) onChange(exact);
        setQuery(exact);
      } else setQuery(value);
    }, 120);
  };

  const activeId = open && options[active] ? `${id}-opt-${active}` : undefined;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-rose-400" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          aria-required={required}
          autoComplete="address-level2"
          className={cn("input pl-10 pr-10", error && "border-rose-500/70")}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close city list" : "Open city list"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={`${label} options`}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-border-strong bg-bg-elevated p-1.5 shadow-2xl"
      >
        {options.length === 0 ? (
          <li className="px-3 py-2.5 text-sm text-muted" role="presentation">
            No match – choose “Other (mention in address)”.
          </li>
        ) : (
          options.map((c, i) => (
            <li
              key={c}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={c === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(c)}
              onMouseMove={() => active !== i && setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm",
                i === active ? "bg-violet-500/15 text-fg" : "text-muted"
              )}
            >
              {c}
              {c === value && <Check className="size-4 text-violet-400" aria-hidden="true" />}
            </li>
          ))
        )}
      </ul>
      {error && (
        <p id={errId} className="mt-1.5 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
