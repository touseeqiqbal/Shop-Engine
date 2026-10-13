"use client";
import { useMemo, useState } from "react";

/** Help page: pick a task, follow the numbered steps, open the right screen. */

export type Guide = { title: string; link?: string | null; steps: string; tip?: string | null };

export function HelpScreen({ guides, canEdit }: { guides: Guide[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [openIdx, setOpenIdx] = useState(0);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return guides.map((g, i) => ({ g, i })).filter(({ g }) => !t || `${g.title} ${g.steps} ${g.tip ?? ""}`.toLowerCase().includes(t));
  }, [guides, q]);
  return (
    <div className="urko-home" style={{ maxWidth: 860 }}>
      <div className="urko-pos__head">
        <div>
          <h1 style={{ margin: 0 }}>Help</h1>
          <p className="urko-tip" style={{ margin: "4px 0 0" }}>
            Step-by-step guides for everyday jobs.{" "}
            {canEdit && (
              <a href="/cms/globals/staff-guide" style={{ color: "inherit" }}>
                Edit these guides
              </a>
            )}
          </p>
        </div>
        <input className="urko-privacy__input" style={{ maxWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guides…" aria-label="Search the guides" />
      </div>
      <div className="urko-help">
        {shown.map(({ g, i }) => {
          const open = q.trim() !== "" || openIdx === i;
          const steps = g.steps.split("\n").map((s) => s.trim()).filter(Boolean);
          return (
            <section key={i} className="urko-card urko-help__item">
              <button type="button" className="urko-help__head" aria-expanded={open} onClick={() => setOpenIdx(open ? -1 : i)}>
                <span>{g.title}</span>
                <span aria-hidden="true">{open ? "–" : "+"}</span>
              </button>
              {open && (
                <div className="urko-help__body">
                  <ol>
                    {steps.map((s, n) => (
                      <li key={n}>{s}</li>
                    ))}
                  </ol>
                  {g.tip && <p className="urko-help__tip">💡 {g.tip}</p>}
                  {g.link && (
                    <a className="urko-btn urko-btn--primary" href={g.link}>
                      Open
                    </a>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {shown.length === 0 && <p className="urko-tip">No guide matches “{q}”.</p>}
      </div>
    </div>
  );
}
