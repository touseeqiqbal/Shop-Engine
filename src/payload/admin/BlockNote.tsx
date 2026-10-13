"use client";

/** Short explanation shown at the top of page-builder blocks that have no content of their own. */
export function BlockNote({ text }: { text?: string }) {
  if (!text) return null;
  return <p style={{ margin: "0 0 12px", color: "var(--theme-elevation-600)", fontSize: 13 }}>{text}</p>;
}
