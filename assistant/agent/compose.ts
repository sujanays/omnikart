import type { Lang } from "@/contract/lang";
import { protectedTokens, wordCount } from "@/assistant/speakable";

/**
 * LLM words, code numbers.
 *
 * The executor produces every sentence with the real prices, ratings and dates already filled in by code.
 * The LLM may only say the same thing in a more natural way. Its rewrite is checked here, and is used only
 * if it passes every check; otherwise the original sentence is used. So the LLM can never write a number.
 */

/** Sentences that must never be reworded: the read-back, the order, the refusals, and anything that is only digits. */
export interface Rewritable {
  caption: string;
  readback?: boolean;
  /** one big fact per card for calm mode: leave as is */
  card?: unknown;
}

export function canRewrite(l: Rewritable): boolean {
  if (l.readback || l.card || l.caption.includes("\n")) return false;
  if (wordCount(l.caption) < 5) return false;
  return true;
}

const SCRIPT: Record<Lang, RegExp | null> = {
  en: null,
  hi: /[ऀ-ॿ]/,
  te: /[ఀ-౿]/,
};

const letters = (s: string) => s.replace(/[^\p{L}]/gu, "");

/** True when the rewrite says the same things: same numbers and amounts, same language, about the same length. */
export function rewriteIsSafe(original: string, rewrite: string, lang: Lang): boolean {
  const r = rewrite.trim();
  if (!r) return false;
  // every number, amount, date and size in the rewrite must be one the original had
  // (a number may be left out, as "Number 1" becomes "my first pick", but none may be added or changed)
  const allowed = [...protectedTokens(original)];
  for (const t of protectedTokens(r)) {
    const at = allowed.indexOf(t);
    if (at < 0) return false;
    allowed.splice(at, 1);
  }
  // brand and product names (capitalised words inside a sentence) must survive
  const names = (text: string) =>
    text
      .split(/(?<=[.!?])\s+/)
      .flatMap((sentence) => sentence.split(/\s+/).slice(1))
      .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z0-9'’&-]+$/g, ""))
      .filter((w) => /^[A-Z][A-Za-z'’&-]{2,}$/.test(w))
      .map((w) => w.toLowerCase());
  const have = r.toLowerCase();
  if (names(original).some((w) => !have.includes(w))) return false;
  // the same script as the language we speak
  const script = SCRIPT[lang];
  if (script && !script.test(r) && script.test(original)) return false;
  // not much shorter either: a rewrite that drops half the sentence has dropped facts
  if (wordCount(r) < Math.floor(wordCount(original) * 0.6)) return false;
  // not much longer than the original: the voice limit and the shopper's patience
  if (wordCount(r) > Math.ceil(wordCount(original) * 1.35) + 3) return false;
  // not an instruction, a refusal or markup
  if (/[<>{}[\]]|https?:|as an ai|i cannot|i can't/i.test(r)) return false;
  return letters(r).length >= 3;
}

/** Merge the model's rewrites with the originals, keeping an original wherever the rewrite is not safe. */
export function mergeRewrites<T extends Rewritable>(lines: T[], rewrites: (string | null)[], lang: Lang): { lines: T[]; used: number; rejected: number } {
  let used = 0;
  let rejected = 0;
  const out = lines.map((l, i) => {
    const r = rewrites[i];
    if (typeof r !== "string" || !canRewrite(l)) return l;
    if (!rewriteIsSafe(l.caption, r, lang)) {
      rejected++;
      return l;
    }
    used++;
    return { ...l, caption: r.trim(), speech: r.trim() } as T;
  });
  return { lines: out, used, rejected };
}
