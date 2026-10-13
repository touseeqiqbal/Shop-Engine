import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { LivePreview } from "@/components/blocks/live-preview";
import { getPage } from "@/lib/cms/pages";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

/** Pages built in /cms → Online store → Pages (any handle except “home”, which is the home page). */

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return pageMetadata({
    title: page.meta.title || `${page.title} | ${site.name}`,
    description: page.meta.description || page.h1Text || page.title,
    image: page.meta.image,
    path: `/pages/${slug}`,
    noindex: page.meta.noindex,
    canonical: page.meta.canonical,
  });
}

export default async function BuilderPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "home") permanentRedirect("/");
  const { isEnabled: draft } = await draftMode();
  const page = await getPage(slug, { draft });
  if (!page) notFound();
  return (
    <>
      <RenderBlocks page={page} />
      {draft && <LivePreview />}
    </>
  );
}
