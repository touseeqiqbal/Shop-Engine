import Link from "next/link";
import { Hash } from "lucide-react";
import type { BlogPost } from "@/lib/types";
import { blogCategories, blogTags } from "@/lib/blog";
import { PostCard } from "./post-card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/** Category filter chips shared by /blog, /blog/category/* and /blog/tag/*. */
export function BlogCategoryChips({ all, active }: { all: BlogPost[]; active?: string }) {
  const cats = blogCategories(all);
  const chip = (on: boolean) =>
    cn(
      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
      on ? "border-transparent bg-brand-gradient text-white" : "border-border-strong bg-surface text-muted hover:border-violet-500/50 hover:text-fg"
    );
  return (
    <nav aria-label="Blog categories" className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        <li>
          <Link href="/blog" className={chip(!active)} aria-current={!active ? "page" : undefined}>
            All posts <span className="opacity-70">{all.length}</span>
          </Link>
        </li>
        {cats.map((c) => (
          <li key={c.slug}>
            <Link href={`/blog/category/${c.slug}`} className={chip(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
              {c.name} <span className="opacity-70">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BlogTagCloud({ all, active }: { all: BlogPost[]; active?: string }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Popular topics">
      {blogTags(all).map((t) => (
        <li key={t.slug}>
          <Link
            href={`/blog/tag/${t.slug}`}
            aria-current={active === t.slug ? "page" : undefined}
            className={cn("chip transition-colors hover:border-violet-500/50 hover:text-fg", active === t.slug ? "border-violet-500/60 text-fg" : "text-muted")}
          >
            <Hash className="size-3" aria-hidden="true" />
            {t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PostGrid({ posts, headingLevel = "h2" }: { posts: BlogPost[]; headingLevel?: "h2" | "h3" }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {posts.map((p, i) => (
        <Reveal as="li" key={p.id} delay={(i % 3) * 0.05}>
          <PostCard post={p} headingLevel={headingLevel} />
        </Reveal>
      ))}
    </ul>
  );
}
