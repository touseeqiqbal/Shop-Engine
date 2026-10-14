import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSiteInfo } from "@/lib/repo/site-content";
import { currentOrigin, getCurrentStore } from "@/lib/tenant";

export const OG_SIZE = { width: 1200, height: 630 };
const BRAND_GRADIENT = "linear-gradient(135deg, #00C6FF 0%, #3B82F6 50%, #8B5CF6 100%)";

/** The original shop's brand mark (public/brand/urko-mark.svg) as a data URI, or null when not available. */
async function brandMarkDataUri() {
  try {
    const svg = await readFile(join(process.cwd(), "public/brand/urko-mark.svg"));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}

function Mark({ src, size, initial }: { src: string | null; size: number; initial: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={size} height={size} alt="" style={{ width: size, height: size }} />;
  }
  // Fallback: gradient tile with the store's first letter.
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size * 0.28, backgroundImage: BRAND_GRADIENT, alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.55, fontWeight: 800 }}>
      {initial}
    </div>
  );
}

/**
 * Premium branded 1200×630 social card. Used by the root opengraph-image and per-article images.
 * Name, place and address come from the current store (Settings → Store details); only the original shop shows its mark.
 */
export async function brandOgImage({ title, eyebrow, footer }: { title: string; eyebrow?: string; footer?: string }) {
  const [info, store, origin] = await Promise.all([getSiteInfo(), getCurrentStore(), currentOrigin()]);
  const mark = !store || store.isDefault ? await brandMarkDataUri() : null;
  // "Acme Tech Store" → ACME + TECH STORE (first word in white, the rest in the accent colour)
  const [first = "", ...rest] = info.name.trim().split(/\s+/);
  const place = [info.address.area, info.address.city, info.address.country].filter(Boolean).join(" · ");
  const long = title.length > 60;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#0A0A0F",
          backgroundImage:
            "radial-gradient(circle at 88% 12%, rgba(0,198,255,0.35), transparent 42%), radial-gradient(circle at 8% 100%, rgba(139,92,246,0.38), transparent 45%), linear-gradient(135deg, #0A0A0F 0%, #11111B 60%, #170F2C 100%)",
          color: "#F4F6FB",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark src={mark} size={72} initial={first.charAt(0).toUpperCase()} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>
              <span style={{ color: "#FFFFFF" }}>{first.toUpperCase()}</span>
              {rest.length > 0 && <span style={{ color: "#00D4FF", marginLeft: 12 }}>{rest.join(" ").toUpperCase()}</span>}
            </div>
            {place && <span style={{ fontSize: 18, color: "#A1A8B8", letterSpacing: 4, marginTop: 4 }}>{place.toUpperCase()}</span>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
          {eyebrow && (
            <div style={{ display: "flex" }}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: "#7DD3FC",
                  border: "2px solid rgba(0,198,255,0.5)",
                  background: "rgba(0,198,255,0.1)",
                  borderRadius: 999,
                  padding: "8px 22px",
                  marginBottom: 26,
                  textTransform: "uppercase",
                }}
              >
                {eyebrow}
              </span>
            </div>
          )}
          <div style={{ fontSize: long ? 58 : 70, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
          <div style={{ display: "flex", width: 160, height: 8, borderRadius: 8, backgroundImage: BRAND_GRADIENT, marginTop: 32 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#A1A8B8" }}>
          <span>{footer ?? "Cash on Delivery · Checked & Tested · Warranty"}</span>
          <span style={{ color: "#F4F6FB", fontWeight: 700 }}>{origin.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
