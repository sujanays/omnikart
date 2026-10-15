import type { Lang } from "@/contract/lang";

/**
 * Key for a saved audio line. The same text in the same language always gives the same key,
 * in the browser and in scripts/voicepack.ts. FNV-1a, 32 bit, plus the length to make clashes unlikely.
 */
export function voiceKey(lang: Lang, text: string): string {
  let h = 2166136261;
  const s = `${lang}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${lang}-${(h >>> 0).toString(16).padStart(8, "0")}-${s.length.toString(16)}`;
}
