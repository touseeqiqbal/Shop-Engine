"use client";

import { useEffect, useState } from "react";

/**
 * A picked photo's preview. Its temporary object URL is released when the photo is removed or the form goes away
 * (making a new URL on every render, as before, kept every one of them – and the photo – in memory).
 */
export function FilePreview({ file, className }: { file: File; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  // a local preview (blob: URL) – next/image can't optimise it
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}
