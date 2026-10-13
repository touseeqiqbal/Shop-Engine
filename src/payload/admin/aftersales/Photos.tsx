"use client";
import { useField } from "@payloadcms/ui";

/** Customer photos on a return / warranty claim (private – only staff can open them). */
export function Photos({ path }: { path: string }) {
  const { value } = useField<string[] | null>({ path });
  const keys = Array.isArray(value) ? value.filter((k) => typeof k === "string") : [];
  return (
    <div className="field-type urko-photos">
      <span className="field-label">Customer photos</span>
      {keys.length ? (
        <div className="urko-photos__grid">
          {keys.map((k) => (
            <a key={k} href={`/cms-file?key=${encodeURIComponent(k)}`} target="_blank" rel="noreferrer">
              <img src={`/cms-file?key=${encodeURIComponent(k)}`} alt="Customer photo" loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <p className="urko-tip">No photos.</p>
      )}
    </div>
  );
}
