"use client";
import { FieldLabel, useField } from "@payloadcms/ui";
import { CATEGORY_ICONS } from "@/components/ui/category-icon";

/** Categories → Icon: click an icon instead of typing its name. Stores the same icon name the storefront uses. */
const LABELS: Record<string, string> = {
  Laptop: "Laptop",
  Mouse: "Mouse",
  Keyboard: "Keyboard",
  PlugZap: "Charger",
  BatteryCharging: "Battery",
  HardDrive: "Storage",
  MemoryStick: "RAM",
  Headphones: "Audio",
  Briefcase: "Bag / accessories",
  Cable: "Cables",
  Wifi: "Networking",
  Monitor: "Monitor",
  Webcam: "Webcam",
  Cpu: "Parts / CPU",
  Gamepad2: "Gaming",
  Usb: "USB",
  Speaker: "Speaker",
  Printer: "Printer",
  Smartphone: "Phone",
  Tablet: "Tablet",
  Camera: "Camera",
  Package: "Other",
};

export function IconPickerField({ path }: { path: string }) {
  const { value, setValue } = useField<string>({ path });
  const current = value && CATEGORY_ICONS[value] ? value : "Package";
  return (
    <div className="field-type" style={{ marginBottom: 24 }}>
      <FieldLabel label="Icon" path={path} />
      <p style={{ margin: "0 0 10px", color: "var(--theme-elevation-500)", fontSize: 13 }}>Shown on the category tiles on the home page and in menus. Click one.</p>
      <div role="radiogroup" aria-label="Category icon" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
        {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
          const on = name === current;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setValue(name)}
              title={name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 6px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                border: on ? "2px solid var(--theme-success-500, #6366f1)" : "1px solid var(--theme-elevation-150)",
                background: on ? "var(--theme-elevation-100)" : "var(--theme-input-bg)",
                color: "var(--theme-text)",
              }}
            >
              <Icon size={22} aria-hidden="true" />
              {LABELS[name] ?? name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
