import { marked } from "marked";
import type { BlogPost } from "./types";
import { slugify } from "./utils";
import { sanitizeHtml } from "@/lib/sanitize";

/** URL helpers for blog taxonomy pages. */
export const blogCategorySlug = (category: string) => slugify(category);
export const blogTagSlug = (tag: string) => slugify(tag);
export const blogCategoryHref = (category: string) => `/blog/category/${blogCategorySlug(category)}`;
export const blogTagHref = (tag: string) => `/blog/tag/${blogTagSlug(tag)}`;

export interface TocHeading {
  id: string;
  text: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/**
 * Renders trusted article Markdown to HTML and gives every H2/H3 a stable `id`
 * (used by the table of contents and for deep links). Returns the H2 list for the TOC.
 */
export function renderArticle(markdown: string): { html: string; headings: TocHeading[] } {
  const raw = sanitizeHtml(marked.parse(markdown, { async: false, gfm: true }) as string);
  const used = new Map<string, number>();
  const headings: TocHeading[] = [];
  const html = raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const text = decode(inner);
    let id = slugify(text) || "section";
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    if (level === "2") headings.push({ id, text });
    return `<h${level} id="${id}" class="scroll-mt-28">${inner}</h${level}>`;
  });
  // Open external links safely in a new tab; internal links stay client-side friendly.
  const safeHtml = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
  return { html: safeHtml, headings };
}

/** Unique categories with post counts (in first-seen order, i.e. newest first). */
export function blogCategories(posts: BlogPost[]) {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of posts) {
    const slug = blogCategorySlug(p.category);
    const cur = map.get(slug);
    if (cur) cur.count++;
    else map.set(slug, { name: p.category, slug, count: 1 });
  }
  return [...map.values()];
}

/** Unique tags with post counts, most used first. */
export function blogTags(posts: BlogPost[]) {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of posts)
    for (const t of p.tags) {
      const slug = blogTagSlug(t);
      const cur = map.get(slug);
      if (cur) cur.count++;
      else map.set(slug, { name: t, slug, count: 1 });
    }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
