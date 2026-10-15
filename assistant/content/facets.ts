import type { Lang } from "@/contract/lang";
import type { FacetDef, Filters, PriceRange } from "@/contract";
import { has, tokenize } from "@/assistant/lexicon";
import { normalizeDigits } from "@/assistant/speakable";
import { spokenEnglishNumber } from "@/assistant/agent/keyword";
import { foldIndicNumbers } from "@/assistant/content/numberwords";

/**
 * Understanding what the shopper says about a filter, in three languages, without translation or the AI.
 * It works on the filter definitions the store publishes in meta(): it knows no category and no brand.
 */

export type Facet = FacetDef;
export type { Filters, PriceRange };

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const emptyFilters = (): Filters => ({ sel: {} });

export function facetById(facets: Facet[], id: string | null | undefined): Facet | undefined {
  return id ? facets.find((f) => f.id === id) : undefined;
}

/** Facets asked aloud, in the order the store lists them. */
export function askedFacets(facets: Facet[]): Facet[] {
  return facets.filter((f) => !!f.ask);
}

/** The price band option that matches the current price filter exactly, if any. */
export function activeBudgetOption(facets: Facet[], f: Filters): string | null {
  const b = facetById(facets, "budget");
  if (!b || !f.price) return null;
  const hit = b.options.find((o) => o.price && o.price.min === f.price?.min && o.price.max === f.price?.max);
  return hit?.id ?? null;
}

/** Words for the filters currently on: "Samsung, under ₹20,000". */
export function describeFilters(f: Filters, facets: Facet[], lang: Lang): string[] {
  const out: string[] = [];
  if (f.price) {
    const hit = activeBudgetOption(facets, f);
    if (hit) out.push(facetById(facets, "budget")!.options.find((o) => o.id === hit)!.label[lang]);
    else if (f.price.min !== undefined && f.price.max !== undefined) out.push({ en: `${money(f.price.min)} to ${money(f.price.max)}`, hi: `${money(f.price.min)} से ${money(f.price.max)} तक`, te: `${money(f.price.min)} నుండి ${money(f.price.max)} వరకు` }[lang]);
    else if (f.price.max !== undefined) out.push({ en: `under ${money(f.price.max + 1)}`, hi: `${money(f.price.max + 1)} से कम`, te: `${money(f.price.max + 1)} లోపు` }[lang]);
    else if (f.price.min !== undefined) out.push({ en: `above ${money(f.price.min - 1)}`, hi: `${money(f.price.min - 1)} से ज़्यादा`, te: `${money(f.price.min - 1)} కంటే ఎక్కువ` }[lang]);
  }
  if (f.rating !== undefined) out.push({ en: `${f.rating} stars and up`, hi: `${f.rating} स्टार या ज़्यादा`, te: `${f.rating} స్టార్లు లేదా ఎక్కువ` }[lang]);
  for (const facet of facets) {
    const ids = f.sel[facet.id];
    if (!ids?.length) continue;
    out.push(facet.options.filter((o) => ids.includes(o.id)).map((o) => o.label[lang]).join(` ${{ en: "or", hi: "या", te: "లేదా" }[lang]} `));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Understanding a spoken answer, without translation or the AI
 * ------------------------------------------------------------------ */

const MULTIPLIER: Record<string, number> = {
  k: 1000, thousand: 1000, hazaar: 1000, hazar: 1000, "हज़ार": 1000, "हजार": 1000, "వేల": 1000, "వేలు": 1000, "వెయ్యి": 1000, "లక్షలు": 100000,
  lakh: 100000, lac: 100000, "लाख": 100000, "లక్ష": 100000,
  hundred: 100, "सौ": 100, "వంద": 100, "వందలు": 100, "వందల": 100,
};

/** Every number in a sentence, in the order said: digits, "15 thousand", "fifteen thousand", "1.5 lakh". */
export function numbersIn(text: string): number[] {
  const t = normalizeDigits(text).toLowerCase().replace(/(\d),(\d)/g, "$1$2");
  const words = foldIndicNumbers(t.split(/[^\p{L}\p{M}\p{N}.‌‍]+/u).filter(Boolean).map((w) => w.replace(/[‌‍]/g, "")));
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const m = w.match(/^(\d+(?:\.\d+)?)(k)?$/);
    if (m) {
      const n = Number(m[1]);
      const mult = m[2] ? 1000 : MULTIPLIER[words[i + 1] ?? ""];
      if (mult && !m[2]) i++;
      out.push(n * (m[2] ? 1000 : (mult ?? 1)));
      continue;
    }
    // a run of English number words: "fifteen hundred", "twenty thousand"
    const run: string[] = [];
    let j = i;
    while (j < words.length && spokenEnglishNumber([words[j]]) !== null) run.push(words[j++]);
    if (run.length) {
      const n = spokenEnglishNumber(run);
      if (n !== null) out.push(n);
      i = j - 1;
    }
  }
  return out;
}

const UNDER = /\b(under|below|less than|within|upto|up to|at most|not more than|maximum|max)\b|से कम|तक|లోపు|కంటే తక్కువ/;
const ABOVE = /\b(above|over|more than|at least|minimum|min|beyond)\b|से ज़्यादा|से ज्यादा|से अधिक|కంటే ఎక్కువ/;

/** "under fifteen thousand", "ten to twenty thousand", "above 20000". Returns null if no money was said. */
export function parseBudget(text: string): PriceRange | null {
  const nums = numbersIn(text).filter((n) => n >= 100);
  const low = normalizeDigits(text).toLowerCase();
  if (nums.length === 0) {
    // "ten to twenty thousand": the first number is small because "thousand" was said once
    const all = numbersIn(text);
    if (all.length >= 2 && /thousand|hazaar|हज़ार|వేల/.test(low) && all[0] < 1000 && all[1] >= 1000) return { min: all[0] * 1000, max: all[1] };
    return null;
  }
  if (nums.length >= 2) {
    const [a, b] = [nums[0], nums[1]].sort((x, y) => x - y);
    return { min: a, max: b };
  }
  const all = numbersIn(text);
  if (all.length >= 2 && all[0] < 1000 && nums[0] === all[1] && /to|and|से|నుండి|between/.test(low)) return { min: all[0] * 1000, max: nums[0] };
  if (UNDER.test(low)) return { max: nums[0] - (/\b(under|below|less than)\b|से कम|లోపు/.test(low) ? 1 : 0) };
  if (ABOVE.test(low)) return { min: nums[0] + (/\b(above|over|more than|beyond)\b|से ज़्यादा|से ज्यादा/.test(low) ? 1 : 0) };
  return { max: nums[0] };
}

export type FacetAnswer =
  | { kind: "options"; ids: string[] }
  | { kind: "price"; price: PriceRange }
  | { kind: "skip" }
  | { kind: "none" };

/**
 * Match what the shopper said against this filter's options.
 * `ordinal` is 1, 2 or 3 when they said "first", "second" or "third".
 */
export function matchFacetAnswer(facet: Facet, text: string, lang: Lang, ordinal?: 1 | 2 | 3): FacetAnswer {
  const toks = tokenize(text);
  if (toks.length === 0) return { kind: "none" };
  const hay = ` ${toks.join(" ")} `;
  // a budget said in words or digits wins over "any": "any phone under 15000" is an answer, not a skip
  if (facet.kind === "band") {
    const price = parseBudget(text);
    if (price) return { kind: "price", price };
  }
  if (toks.length <= 5 && has(text, "skip", lang)) return { kind: "skip" };

  if (facet.kind === "bool") {
    if (has(text, "yes", lang)) return { kind: "options", ids: [facet.options[0].id] };
    if (has(text, "no", lang)) return { kind: "skip" };
    const hit = facet.options[0].words.some((w) => w && hay.includes(` ${w.toLowerCase()} `));
    return hit ? { kind: "options", ids: [facet.options[0].id] } : { kind: "none" };
  }

  const ids: string[] = [];
  const nums = facet.kind === "band" ? [] : numbersIn(text);
  for (const o of facet.options) {
    const wordHit = o.words.some((w) => w && hay.includes(` ${tokenize(w).join(" ")} `));
    const numHit = !!o.numbers && o.numbers.some((n) => nums.includes(n));
    if (wordHit || numHit) ids.push(o.id);
  }
  if (ids.length === 0 && ordinal) {
    const list = facet.askOptions ?? facet.options.map((o) => o.id);
    const pick = list[ordinal - 1];
    if (pick) ids.push(pick);
  }
  // a size facet: only one size at a time
  const final = facet.kind === "size" ? ids.slice(0, 1) : ids;
  return final.length ? { kind: "options", ids: final } : { kind: "none" };
}

/**
 * The AI gave us a facet name and what the shopper said for it (set_filter). Find the option.
 * The same matcher as above, so the AI path and the fast path cannot disagree.
 */
export function matchFacetValue(facet: Facet, value: string, lang: Lang): FacetAnswer {
  return matchFacetAnswer(facet, value, lang);
}

