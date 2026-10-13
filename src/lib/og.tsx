import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };
const BRAND_GRADIENT = "linear-gradient(135deg, #00C6FF 0%, #3B82F6 50%, #8B5CF6 100%)";

/** Official brand mark (public/brand/urko-mark.svg) as a data URI, or null when not available. */
async function brandMarkDataUri() {
  try {
    const svg = await readFile(join(process.cwd(), "public/brand/urko-mark.svg"));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}

function Mark({ src, size }: { src: string | null; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={size} height={size} alt="" style={{ width: size, height: size }} />;
  }
  // Fallback: gradient tile with the "U" mark.
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size * 0.28, backgroundImage: BRAND_GRADIENT, alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40">
        <path d="M12 11v11a8 8 0 0 0 16 0V11" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 11v9" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
      </svg>
    </div>
  );
}

/**
 * Premium branded 1200×630 social card. Used by the root opengraph-image and per-article images.
 */
export async function brandOgImage({ title, eyebrow, footer }: { title: string; eyebrow?: string; footer?: string }) {
  const mark = await brandMarkDataUri();
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
          <Mark src={mark} size={72} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>
              <span style={{ color: "#FFFFFF" }}>URKO</span>
              <span style={{ color: "#00D4FF", marginLeft: 12 }}>TECH STORE</span>
            </div>
            <span style={{ fontSize: 18, color: "#A1A8B8", letterSpacing: 4, marginTop: 4 }}>SADDAR · KARACHI · PAKISTAN</span>
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
          <span style={{ color: "#F4F6FB", fontWeight: 700 }}>{site.url.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
