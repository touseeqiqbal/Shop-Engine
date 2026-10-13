import { brandOgImage, OG_SIZE } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} – Laptops & Tech Accessories – Delivered All Over Pakistan`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage() {
  return brandOgImage({
    eyebrow: "Laptop shop in Karachi",
    title: "Laptops & Tech Accessories – Delivered All Over Pakistan",
    footer: "New · Used · Refurbished — Cash on Delivery nationwide",
  });
}
