"use client";
import { useEffect } from "react";
import Link from "next/link";

/**
 * Last-resort error boundary (replaces the root layout, so it must render <html>/<body> and
 * cannot rely on globals.css). Kept dependency-free with inline styles. It runs without the store's
 * profile (the root layout is gone), so it names no store and shows no contact details.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0A0A0F",
          color: "#F4F6FB",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 16,
        }}
      >
        <main role="alert" style={{ maxWidth: 480, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto",
              borderRadius: 16,
              background: "linear-gradient(135deg, #00C6FF, #3B82F6 50%, #8B5CF6)",
            }}
            aria-hidden="true"
          />
          <h1 style={{ fontSize: 28, margin: "24px 0 8px" }}>This shop is having a moment</h1>
          <p style={{ color: "#A1A8B8", lineHeight: 1.6, margin: 0 }}>
            Something went wrong while loading the site. Please try again in a moment.
          </p>
          {error.digest && <p style={{ color: "#6B7385", fontSize: 12, fontFamily: "monospace" }}>Error ref: {error.digest}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{ border: 0, borderRadius: 999, padding: "12px 22px", fontWeight: 600, fontSize: 15, color: "#fff", background: "linear-gradient(120deg, #3B82F6, #8B5CF6)", cursor: "pointer" }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{ borderRadius: 999, padding: "12px 22px", fontWeight: 600, fontSize: 15, color: "#fff", background: "rgba(255,255,255,0.12)", textDecoration: "none" }}
            >
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
