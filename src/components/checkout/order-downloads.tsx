import { Download } from "lucide-react";
import type { OrderDownloads } from "@/payload/downloads";

/** "Your downloads" on the order pages: a button per file once the order is paid. Server component. */
export function OrderDownloadsCard({ downloads, formatDate }: { downloads: OrderDownloads; formatDate: (iso: string) => string }) {
  return (
    <section className="card space-y-3 p-5" aria-labelledby="order-downloads">
      <h2 id="order-downloads" className="flex items-center gap-2 font-display font-bold">
        <Download className="size-4 text-violet-300" aria-hidden="true" /> Your downloads
      </h2>
      {!downloads.paid ? (
        <p className="text-sm text-muted">Your download{downloads.files.length === 1 ? " is" : "s are"} ready here as soon as the payment is confirmed – we&apos;ll email the links too.</p>
      ) : (
        <ul className="space-y-3">
          {downloads.files.map((f) => (
            <li key={f.fileId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-strong p-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{f.title}</span>
                <span className="block text-xs text-muted">
                  {f.used} of {f.limit} downloads used · until {formatDate(f.until)}
                </span>
              </span>
              {f.url ? (
                <a href={f.url} className="btn btn-primary btn-sm" rel="nofollow">
                  <Download className="size-4" aria-hidden="true" /> Download
                </a>
              ) : (
                <span className="text-xs text-muted">{f.used >= f.limit ? "All downloads used" : "Download period ended"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
