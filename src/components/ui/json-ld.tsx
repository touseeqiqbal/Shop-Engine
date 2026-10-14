import { site } from "@/lib/site";
import { currentOrigin } from "@/lib/tenant";

/**
 * Renders schema.org JSON-LD. `<` is escaped to prevent script injection. Links built for the main address are moved
 * to the current store's own address (every store's structured data points at its own pages).
 */
export async function JsonLd({ data }: { data: object | object[] }) {
  const origin = await currentOrigin();
  let json = JSON.stringify(data);
  if (origin && origin !== site.url) json = json.split(site.url).join(origin);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }} />;
}
