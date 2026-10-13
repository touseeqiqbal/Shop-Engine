import { Fragment, type ReactNode } from "react";

/**
 * Tiny inline formatter for admin-editable one-liners (titles, intros):
 *   **bold**  → <strong class="text-fg">
 *   *words*   → brand-gradient highlight (e.g. a hero title "Hot *deals*")
 * Everything else is rendered as plain text (no HTML injection).
 */
export function InlineText({ text, strongClassName = "text-fg", highlightClassName = "gradient-text" }: { text: string; strongClassName?: string; highlightClassName?: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++} className={strongClassName}>{tok.slice(2, -2)}</strong>);
    else parts.push(<span key={i++} className={highlightClassName}>{tok.slice(1, -1)}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
