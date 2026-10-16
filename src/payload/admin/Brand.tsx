/* ShopEngine branding inside the Payload admin (login screen logo + nav icon) – the mark from public/brand/shopengine.
   The store being worked in is named in the menu. The wordmark is text so it follows the admin's light / dark theme. */

const GRADIENT = "linear-gradient(90deg, #0052ec 0%, #3b2dee 55%, #631cf1 100%)";

export function Icon() {
  return <img src="/brand/shopengine/favicon-48.png" width={24} height={24} alt="ShopEngine" style={{ display: "block" }} />;
}

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img src="/brand/shopengine/apple-touch-icon.png" width={56} height={56} alt="" aria-hidden="true" style={{ display: "block" }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
          <span style={{ color: "var(--theme-text, #070f25)" }}>Shop</span>
          <span style={{ backgroundImage: GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Engine</span>
        </span>
        <span style={{ fontSize: 13, letterSpacing: "0.02em", color: "#1094fc", marginTop: 6, fontWeight: 600 }}>The engine that powers shops</span>
      </div>
    </div>
  );
}
