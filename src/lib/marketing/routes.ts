import { ARTICLES } from "./content";
import { SOLUTIONS } from "./solutions";

/** Every public page of the marketing site – the sitemap lists these (and a test checks each one exists). */
export function marketingRoutes(): { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly"; lastModified?: string }[] {
  return [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    ...SOLUTIONS.map((s) => ({ path: `/solutions/${s.slug}`, priority: 0.8, changeFrequency: "monthly" as const })),
    { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
    { path: "/security", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
    ...ARTICLES.map((a) => ({ path: `/blog/${a.slug}`, priority: 0.5, changeFrequency: "yearly" as const, lastModified: a.date })),
    { path: "/about", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];
}
