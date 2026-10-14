import { brandOgImage, OG_SIZE } from "@/lib/og";
import { getSiteInfo } from "@/lib/repo/site-content";
import { getCurrentStore } from "@/lib/tenant";

// one file serves every store, so the alt text names no store (pages pass their own title as alt)
export const alt = "Shop banner";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [store, info] = await Promise.all([getCurrentStore(), getSiteInfo()]);
  // any other store than the original shop: its own name and tagline (from Settings → Store details)
  if (store && !store.isDefault) return brandOgImage({ title: info.tagline || info.name });
  return brandOgImage({
    eyebrow: "Laptop shop in Karachi",
    title: "Laptops & Tech Accessories – Delivered All Over Pakistan",
    footer: "New · Used · Refurbished — Cash on Delivery nationwide",
  });
}
