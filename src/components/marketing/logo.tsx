import Image from "next/image";

/**
 * ShopEngine's logo: the bag mark (public/brand/shopengine) and the wordmark – "Shop" in ink (or white on dark), "Engine"
 * in the brand gradient (a lighter cut of it on dark backgrounds, so it stays readable). Text, not a picture, so it stays
 * sharp at every size.
 */
export const BRAND_GRADIENT = "linear-gradient(90deg, #0052EC 0%, #3B2DEE 55%, #631CF1 100%)";
export const BRAND_GRADIENT_ON_DARK = "linear-gradient(90deg, #3d86ff 0%, #6f63ff 55%, #a173ff 100%)";

export function ShopEngineLogo({ size = 32, onDark = false, className = "" }: { size?: number; onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <Image src="/brand/shopengine/icon.png" alt="" width={size} height={size} priority sizes={`${size}px`} style={{ width: size, height: size }} />
      <span aria-hidden="true" style={{ fontWeight: 750, fontSize: size * 0.66, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
        <span style={{ color: onDark ? "#ffffff" : "#070F25" }}>Shop</span>
        <span style={{ backgroundImage: onDark ? BRAND_GRADIENT_ON_DARK : BRAND_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Engine</span>
      </span>
      <span className="sr-only">ShopEngine</span>
    </span>
  );
}
