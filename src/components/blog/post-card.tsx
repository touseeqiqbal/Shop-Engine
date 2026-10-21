import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock } from "lucide-react";
import type { BlogPost } from "@/lib/types";
import { blogCategoryHref } from "@/lib/blog";
import { getDateFormatter } from "@/lib/store-locale";
import { cn, readingTime } from "@/lib/utils";

/** Blog post teaser. `featured` renders a large horizontal hero card. */
export async function PostCard({ post, featured, className, headingLevel = "h2" }: { post: BlogPost; featured?: boolean; className?: string; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const date = await getDateFormatter(); // the store's language and time zone
  return (
    <article
      className={cn(
        "group glow-hover card relative flex overflow-hidden transition-transform duration-300 hover:-translate-y-1",
        featured ? "flex-col lg:grid lg:grid-cols-[1.25fr_1fr]" : "h-full flex-col",
        className
      )}
    >
      <div className={cn("relative overflow-hidden bg-bg-elevated", featured ? "aspect-[1200/630] lg:aspect-auto lg:min-h-[22rem]" : "aspect-[1200/630]")}>
        <Image
          src={post.cover}
          alt={post.title}
          fill
          priority={featured}
          sizes={featured ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <div className={cn("flex flex-1 flex-col", featured ? "p-6 sm:p-8 lg:justify-center lg:p-10" : "p-5")}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link href={blogCategoryHref(post.category)} className="chip relative z-[2] text-violet-300 hover:border-violet-500/60 light:text-violet-700">
            {post.category}
          </Link>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <time dateTime={post.publishedAt}>{date(post.publishedAt)}</time>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {post.minutes ?? readingTime(post.content)} min read
          </span>
        </div>
        <H className={cn("font-bold leading-tight text-fg", featured ? "text-2xl sm:text-3xl lg:text-4xl" : "text-lg sm:text-xl")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
            {post.title}
          </Link>
        </H>
        <p className={cn("mt-3 text-muted", featured ? "text-base" : "line-clamp-3 text-sm")}>{post.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-fg">
          Read article
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
