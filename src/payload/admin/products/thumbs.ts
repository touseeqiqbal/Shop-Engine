/** Batches thumbnail lookups from every list row into one request. */
type Thumb = { url: string; alt: string } | null;
const cache = new Map<string, Promise<Thumb>>();
let queue: { id: string; resolve: (t: Thumb) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  const ids = [...new Set(batch.map((b) => b.id))];
  const qs = new URLSearchParams({ depth: "0", limit: String(ids.length), pagination: "false" });
  ids.forEach((id, i) => qs.set(`where[id][in][${i}]`, id));
  const found = new Map<string, Thumb>();
  try {
    const res = await fetch(`/cms-api/media?${qs}`, { credentials: "include" });
    const json = (await res.json()) as { docs?: { id: string | number; url?: string; alt?: string; sizes?: { thumbnail?: { url?: string } } }[] };
    for (const m of json.docs ?? []) {
      const url = m.sizes?.thumbnail?.url || m.url;
      found.set(String(m.id), url ? { url, alt: m.alt ?? "" } : null);
    }
  } catch {
    /* thumbnails are decoration – the list still works without them */
  }
  for (const b of batch) b.resolve(found.get(b.id) ?? null);
}

export function getThumb(id: string): Promise<Thumb> {
  let p = cache.get(id);
  if (!p) {
    p = new Promise<Thumb>((resolve) => {
      queue.push({ id, resolve });
      if (!timer) timer = setTimeout(flush, 30);
    });
    cache.set(id, p);
  }
  return p;
}
