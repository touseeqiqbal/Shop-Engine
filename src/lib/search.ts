/**
 * Product search (pure, no database): ranks the catalogue by how well each product matches what was typed.
 *
 * - Words: lower-cased; common Urdu product words → English ("لیپ ٹاپ" → laptop); "8 gb" → "8gb"; plurals trimmed.
 * - Synonyms: notebook → laptop, adapter → charger, mac → macbook/apple, …
 * - Typos: a word that is 1 letter off (2 for long words) still matches ("macbok" → macbook, "thinkpd" → thinkpad).
 * - Ranking: what the product IS (its main category, e.g. "laptop") > name > SKU > brand/sub-category > specs/tags;
 *   whole phrase in the name, in-stock and popularity break ties. So "laptop" lists laptops before laptop chargers.
 * - Every typed word must match something (one may be missing when 3+ words are typed).
 * - `suggest()` gives a "Did you mean …?" query built from the catalogue's own words.
 */

export interface Searchable {
  id: string;
  name: string;
  brandName?: string;
  categoryName?: string;
  topCategoryName?: string;
  sku?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  stock?: number;
  soldCount?: number;
}

const URDU: [RegExp, string][] = [
  [/لیپ\s*ٹاپ/g, " laptop "],
  [/چارجر/g, " charger "],
  [/ماؤس|ماوس/g, " mouse "],
  [/کی\s*بورڈ/g, " keyboard "],
  [/بیٹری/g, " battery "],
  [/ہیڈ\s*فون|ہیڈفونز/g, " headphones "],
  [/اسکرین|سکرین/g, " screen "],
  [/ریم/g, " ram "],
  [/مانیٹر/g, " monitor "],
  [/کیبل/g, " cable "],
];

/** typed word → extra words it should also find */
const SYNONYMS: Record<string, string[]> = {
  notebook: ["laptop"],
  laptop: ["notebook"],
  adapter: ["charger"],
  adaptor: ["charger"],
  charger: ["adapter"],
  mice: ["mouse"],
  ram: ["memory"],
  memory: ["ram"],
  ssd: ["storage", "nvme"],
  nvme: ["ssd"],
  hdd: ["hard", "storage"],
  harddisk: ["hdd"],
  mac: ["macbook", "apple"],
  macbook: ["apple"],
  apple: ["macbook"],
  earphones: ["earbuds", "headphones"],
  earbuds: ["earphones", "headphones"],
  headphone: ["headphones", "headset"],
  headset: ["headphones"],
  screen: ["display", "lcd", "panel"],
  display: ["screen", "lcd"],
  lcd: ["display", "screen", "led"],
  led: ["lcd", "display"],
  cooler: ["cooling"],
  cooling: ["cooler"],
  bag: ["backpack", "sleeve"],
  wifi: ["wireless"],
  wireless: ["wifi"],
  usbc: ["type", "c"],
  pc: ["computer", "desktop"],
  desktop: ["pc"],
  gaming: ["gamer"],
  hp: ["hewlett"],
};

const UNITS = new Set(["gb", "tb", "mb", "w", "hz", "mah", "inch", "in", "ghz", "dpi"]);

/** Splits text into normalised words ("Core i5 8 GB" → ["core", "i5", "8gb"]). */
export function words(text: string): string[] {
  let s = String(text ?? "").toLowerCase();
  for (const [re, en] of URDU) s = s.replace(re, en);
  s = s.replace(/[″"]/g, " inch ").replace(/type[\s-]?c\b/g, " usbc ");
  const raw = s.split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    // "8 gb" → "8gb", "15.6 inch" handled as "15", "6inch" – good enough for matching
    if (/^\d+$/.test(raw[i]) && UNITS.has(raw[i + 1] ?? "")) {
      out.push(raw[i] + raw[i + 1]);
      i++;
    } else out.push(raw[i]);
  }
  return out;
}

/** Singular form for simple English plurals (laptops → laptop, batteries → battery). */
function singular(w: string) {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !/\d/.test(w)) return w.slice(0, -1);
  return w;
}

/** Edit distance with an early exit once it exceeds `max`. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos allowed: none for short words or anything with a digit (sizes and model codes must match exactly). */
const typoLimit = (w: string) => (/\d/.test(w) ? 0 : w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

interface Indexed<T> {
  item: T;
  name: string[];
  nameText: string;
  sku: string;
  kind: Set<string>;
  brandCat: Set<string>;
  other: Set<string>;
}

/** What a product IS, from its main category's last word: "Laptop Batteries" → battery, "Chargers & Adapters" → charger, adapter. */
function kindWords(category: string): Set<string> {
  return new Set(
    category
      .split(/\s*(?:&|,|\band\b)\s*/i)
      .map((part) => words(part).pop())
      .filter((w): w is string => Boolean(w))
      .map(singular),
  );
}

function index<T extends Searchable>(items: T[]): Indexed<T>[] {
  return items.map((p) => {
    const name = words(p.name).map(singular);
    return {
      item: p,
      name,
      nameText: ` ${name.join(" ")} `,
      sku: (p.sku ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""),
      kind: kindWords(p.topCategoryName ?? ""),
      brandCat: new Set([...words(p.brandName ?? ""), ...words(p.categoryName ?? ""), ...words(p.topCategoryName ?? "")].map(singular)),
      other: new Set([...(p.tags ?? []).flatMap(words), ...Object.values(p.attributes ?? {}).flatMap((v) => words(String(v)))].map(singular)),
    };
  });
}

/** Best score of ONE typed word (with its synonyms) against a product; 0 = no match. */
function termScore(e: Indexed<Searchable>, term: string, alts: string[]): number {
  let best = 0;
  for (const [w, weight] of [[term, 1], ...alts.map((a) => [a, 0.8] as const)] as [string, number][]) {
    let s = 0;
    if (e.kind.has(w)) s = 14;
    else if (e.name.includes(w)) s = 10;
    else if (e.sku && (e.sku === w || (w.length >= 4 && e.sku.includes(w)))) s = e.sku === w ? 12 : 6;
    else if (e.brandCat.has(w)) s = 6;
    else if (w.length >= 2 && e.name.some((n) => n.startsWith(w))) s = 7;
    else if (e.other.has(w)) s = 4;
    // part of a word ("book" in "elitebook") – but never inside a number ("12gb" is not "512gb")
    else if (w.length >= 3 && !/\d/.test(w) && e.nameText.includes(w)) s = 3;
    else {
      const max = typoLimit(w);
      if (max) {
        if (e.name.some((n) => distance(w, n, max) <= max)) s = 5;
        else if ([...e.brandCat].some((n) => distance(w, n, max) <= max)) s = 3;
        else if ([...e.other].some((n) => n.length >= 4 && distance(w, n, max) <= max)) s = 1.5;
      }
    }
    best = Math.max(best, s * weight);
  }
  return best;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/**
 * Products matching the query, best match first. With `closest`, a query where no product matches every word
 * ("8gb ram" when only 16GB RAM is in stock) returns the products matching most of the words instead.
 */
export function rank<T extends Searchable>(items: T[], query: string, opts: { closest?: boolean } = {}): Ranked<T>[] {
  const terms = [...new Set(words(query).map(singular))].slice(0, 8);
  if (!terms.length) return [];
  const exact = rankTerms(items, terms, terms.length >= 3 ? 1 : 0);
  return exact.length || !opts.closest || terms.length < 2 ? exact : rankTerms(items, terms, terms.length - 1);
}

/** True when `rank(..., { closest: true })` had to fall back to partial matches. */
export function isExactMatch(items: Searchable[], query: string) {
  const terms = [...new Set(words(query).map(singular))].slice(0, 8);
  return rankTerms(items, terms, terms.length >= 3 ? 1 : 0).length > 0;
}

function rankTerms<T extends Searchable>(items: T[], terms: string[], allowMiss: number): Ranked<T>[] {
  const phrase = terms.join(" ");
  const out: Ranked<T>[] = [];
  for (const e of index(items)) {
    let score = 0;
    let missed = 0;
    for (const t of terms) {
      const s = termScore(e, t, SYNONYMS[t] ?? []);
      if (s === 0 && ++missed > allowMiss) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score <= 0) continue;
    if (terms.length > 1 && e.nameText.includes(` ${phrase} `)) score += 8; // the words in this order, side by side
    if ((e.item.stock ?? 1) > 0) score += 1;
    score += Math.min(0.9, (e.item.soldCount ?? 0) / 1000) - missed * 4; // popularity only breaks ties
    out.push({ item: e.item, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** "Did you mean …?" – each typed word replaced by the closest catalogue word (null when nothing better). */
export function suggest(items: Searchable[], query: string): string | null {
  const terms = words(query);
  if (!terms.length) return null;
  const vocab = new Set<string>();
  for (const p of items) for (const w of [...words(p.name), ...words(p.brandName ?? ""), ...words(p.categoryName ?? "")]) if (w.length >= 3) vocab.add(w);
  let changed = false;
  const fixed = terms.map((t) => {
    if (vocab.has(t) || t.length < 3 || /\d/.test(t)) return t;
    let best: string | null = null;
    let bestD = Math.max(2, typoLimit(t) + 1);
    for (const v of vocab) {
      const d = distance(t, v, bestD);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best) changed = true;
    return best ?? t;
  });
  const result = fixed.join(" ");
  return changed && rank(items, result).length ? result : null;
}
