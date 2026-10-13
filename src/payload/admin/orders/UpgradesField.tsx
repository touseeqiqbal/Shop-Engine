"use client";
import { useField } from "@payloadcms/ui";

type Upgrade = { group?: string; label?: string; price?: number };

/** Order item: the upgrades the customer chose (e.g. "RAM: Upgrade to 32GB + Rs 8,000"), read-only instead of raw JSON. */
export function UpgradesField({ path }: { path: string }) {
  const { value } = useField<Upgrade[] | null>({ path });
  const list = Array.isArray(value) ? value.filter((u) => u && typeof u === "object") : [];
  if (!list.length) return null;
  return (
    <div className="field-type">
      <span className="field-label">Upgrades chosen</span>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {list.map((u, i) => (
          <li key={i}>
            {u.group ? `${u.group}: ` : ""}
            {u.label ?? "Upgrade"}
            {Number(u.price) ? ` (+ Rs ${Number(u.price).toLocaleString("en-PK")})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
