import { marked } from "marked";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * "Rich text" page section. Text with several sub-headings (###) is laid out as a centred intro plus one card per
 * sub-heading (two per row on desktop); anything else is a centred reading column.
 */
function splitSections(html: string) {
  const parts = html.split(/(?=<h3[\s>])/i);
  const intro = parts[0].trim();
  const sections = parts.slice(1).map((p) => {
    const m = /^<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*)$/i.exec(p.trim());
    return m ? { title: m[1], body: m[2].trim() } : { title: "", body: p };
  });
  return { intro, sections };
}

export function RichTextSections({ html, markdown, boxed, narrow, label }: { html?: string | null; markdown?: string | null; boxed: boolean; narrow: boolean; label?: string }) {
  const source = sanitizeHtml(html || (marked.parse(markdown ?? "", { async: false }) as string));
  const { intro, sections } = splitSections(source);
  const asCards = sections.length >= 2;

  const content = asCards ? (
    <>
      {intro && <div className="prose-store prose-center mx-auto max-w-3xl text-center text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: intro }} />}
      <div className={cn("grid gap-3 sm:gap-4 md:grid-cols-2", intro && "mt-8 sm:mt-10")}>
        {sections.map((s, i) => (
          <article
            key={i}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-violet-500/40 sm:p-6",
              sections.length % 2 === 1 && i === sections.length - 1 && "md:col-span-2"
            )}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br from-violet-500/15 to-transparent blur-2xl transition-opacity group-hover:opacity-100" aria-hidden="true" />
            <div className="relative flex items-center gap-3 sm:items-start sm:gap-4">
              <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold text-white sm:size-10" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title && <h3 className="min-w-0 font-display text-base font-bold leading-snug text-fg sm:pt-1.5 sm:text-lg" dangerouslySetInnerHTML={{ __html: s.title }} />}
            </div>
            {/* phones: full width under the heading; larger screens: lined up with the heading */}
            <div className="prose-store relative mt-3 text-sm leading-relaxed sm:mt-1 sm:pl-14 [&>*+*]:mt-3" dangerouslySetInnerHTML={{ __html: s.body }} />
          </article>
        ))}
      </div>
    </>
  ) : (
    <div className={cn("prose-store mx-auto text-sm sm:text-base", narrow ? "max-w-3xl" : "max-w-4xl")} dangerouslySetInnerHTML={{ __html: source }} />
  );

  return (
    <section className="container-x" aria-label={label}>
      {boxed ? (
        <div className="card relative overflow-hidden px-4 py-8 sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-blue-500/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative">{content}</div>
        </div>
      ) : (
        content
      )}
    </section>
  );
}
