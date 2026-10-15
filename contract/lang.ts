export type Lang = "en" | "hi" | "te";
export const LANGS: Lang[] = ["en", "hi", "te"];

/** One string in each supported language. */
export type L3 = Record<Lang, string>;

export const LANG_ENGLISH_NAME: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
};
export const LANG_NATIVE_NAME: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
};
/** BCP-47 tags for the browser's own voice (fallback) and the html lang attribute. */
export const LANG_TAG: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
};

export function isLang(x: unknown): x is Lang {
  return x === "en" || x === "hi" || x === "te";
}
