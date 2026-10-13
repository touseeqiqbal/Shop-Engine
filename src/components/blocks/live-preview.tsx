"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshRouteOnSave } from "@payloadcms/live-preview-react";

/**
 * Shown only in Draft Mode: re-renders the page every time the editor's draft autosaves in /cms,
 * plus a small bar to leave preview.
 */
export function LivePreview() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <>
      {origin && <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={origin} apiRoute="/cms-api" />}
      <form action="/api/preview/exit" method="post" className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
        <button type="submit" className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-black shadow-lg">
          Preview mode – showing unpublished changes · Exit
        </button>
      </form>
    </>
  );
}
