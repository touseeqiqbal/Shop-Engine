import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { RenderBlocks } from "@/components/blocks/render-blocks";
import { LivePreview } from "@/components/blocks/live-preview";
import { getHomePage } from "@/lib/cms/pages";
import { getPageMeta } from "@/lib/page-seo";

/*
 * Home page – built in /cms → Online store → Pages → “Home” (page builder with live preview).
 * Until that page exists it renders the old admin's home builder config, identical to the original page.
 */

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getHomePage();
  return getPageMeta("/", { cms: page.meta });
}

export default async function HomePage() {
  const { isEnabled: draft } = await draftMode();
  const page = await getHomePage({ draft });
  return (
    <>
      <RenderBlocks page={page} />
      {draft && <LivePreview />}
    </>
  );
}
