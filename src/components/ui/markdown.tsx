import { marked } from "marked";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";

marked.setOptions({ gfm: true, breaks: false });

/** Renders admin-authored Markdown – cleaned (no scripts), since staff text runs on the same site as /cms. */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = sanitizeHtml(marked.parse(content, { async: false }) as string);
  return <div className={cn("prose-store", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
