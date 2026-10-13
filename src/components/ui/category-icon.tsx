import {
  BatteryCharging, Briefcase, Cable, Camera, Cpu, Gamepad2, HardDrive, Headphones, Keyboard, Laptop, MemoryStick,
  Monitor, Mouse, Package, PlugZap, Printer, Smartphone, Speaker, Tablet, Usb, Webcam, Wifi, type LucideIcon,
} from "lucide-react";

/** Curated icon set selectable for categories in the admin (keeps the bundle small). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Laptop, Mouse, Keyboard, PlugZap, BatteryCharging, HardDrive, MemoryStick, Headphones, Briefcase, Cable, Wifi,
  Monitor, Webcam, Cpu, Gamepad2, Usb, Speaker, Printer, Smartphone, Tablet, Camera, Package,
};

export function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Package;
  return <Icon className={className} aria-hidden="true" />;
}
