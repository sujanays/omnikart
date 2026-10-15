import type { Lang } from "@/contract/lang";
import { DIGITS_MODE, MT_CHUNK_WORDS, SPEECH_CHUNK_WORDS } from "@/assistant/config";

/* ------------------------------------------------------------------ *
 * Digits
 * ------------------------------------------------------------------ */

/** Turn Devanagari and Telugu digits into ASCII digits. */
export function normalizeDigits(s: string): string {
  return s.replace(/[०-९౦-౯]/g, (ch) => {
    const c = ch.charCodeAt(0);
    return String(c >= 0x0c66 ? c - 0x0c66 : c - 0x0966);
  });
}

/* ------------------------------------------------------------------ *
 * Numbers as words (en / hi / te), Indian grouping (lakh, crore)
 * ------------------------------------------------------------------ */

const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const HI_BELOW_100 = [
  "शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चौवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उनासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पंचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

const TE_ONES = [
  "సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది",
  "పది", "పదకొండు", "పన్నెండు", "పదమూడు", "పద్నాలుగు", "పదిహేను", "పదహారు",
  "పదిహేడు", "పద్దెనిమిది", "పంతొమ్మిది",
];
const TE_TENS = ["", "", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంభై"];

type Unit = "hundred" | "thousand" | "lakh" | "crore";

interface NumLang {
  below100: (n: number) => string;
  /** words for `count` followed by the unit, e.g. "two hundred". `last` is true when nothing follows it. */
  unit: (countWords: string, unit: Unit, count: number, last: boolean) => string;
  point: string;
  rupees: string;
  percent: string;
  and: string;
}

const NUM: Record<Lang, NumLang> = {
  en: {
    below100: (n) => (n < 20 ? EN_ONES[n] : EN_TENS[Math.floor(n / 10)] + (n % 10 ? " " + EN_ONES[n % 10] : "")),
    unit: (w, u) => `${w} ${u}`,
    point: "point",
    rupees: "rupees",
    percent: "percent",
    and: "and",
  },
  hi: {
    below100: (n) => HI_BELOW_100[n],
    unit: (w, u) => `${w} ${{ hundred: "सौ", thousand: "हज़ार", lakh: "लाख", crore: "करोड़" }[u]}`,
    point: "दशमलव",
    rupees: "रुपये",
    percent: "प्रतिशत",
    and: "और",
  },
  te: {
    below100: (n) => (n < 20 ? TE_ONES[n] : TE_TENS[Math.floor(n / 10)] + (n % 10 ? " " + TE_ONES[n % 10] : "")),
    // Numbers here are nearly always said before a noun (rupees, GB, days), so plurals use the form that goes
    // before a noun: "ఐదు వందల రూపాయలు". A hundred followed by more is "నూట ఇరవై", not "వంద ఇరవై".
    unit: (w, u, count, last) => {
      if (count === 1) return { hundred: last ? "వంద" : "నూట", thousand: "వెయ్యి", lakh: "లక్ష", crore: "కోటి" }[u];
      return `${w} ${{ hundred: "వందల", thousand: "వేల", lakh: "లక్షల", crore: "కోట్ల" }[u]}`;
    },
    point: "పాయింట్",
    rupees: "రూపాయలు",
    percent: "శాతం",
    and: "మరియు",
  },
};

export function rupeesWord(lang: Lang): string {
  return NUM[lang].rupees;
}

function intWords(n: number, lang: Lang): string {
  const L = NUM[lang];
  if (n < 100) return L.below100(n);
  let rest = n;
  const crore = Math.floor(rest / 1e7);
  rest %= 1e7;
  const lakh = Math.floor(rest / 1e5);
  rest %= 1e5;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  const hundred = Math.floor(rest / 100);
  rest %= 100;
  const parts: string[] = [];
  const lastUnit = (after: number) => after === 0;
  if (crore) parts.push(L.unit(intWords(crore, lang), "crore", crore, lastUnit(rest + hundred * 100 + thousand * 1000 + lakh * 1e5)));
  if (lakh) parts.push(L.unit(intWords(lakh, lang), "lakh", lakh, lastUnit(rest + hundred * 100 + thousand * 1000)));
  if (thousand) parts.push(L.unit(intWords(thousand, lang), "thousand", thousand, lastUnit(rest + hundred * 100)));
  if (hundred) parts.push(L.unit(intWords(hundred, lang), "hundred", hundred, lastUnit(rest)));
  if (rest) parts.push(L.below100(rest));
  return parts.join(" ");
}

/** Each digit on its own: "4 0 7". Used for order numbers and totals read digit by digit. */
export function spellDigits(s: string, lang: Lang): string {
  const out: string[] = [];
  for (const ch of normalizeDigits(s)) {
    if (ch >= "0" && ch <= "9") out.push(NUM[lang].below100(Number(ch)));
  }
  return out.join(" ");
}

/** 1299 -> "one thousand two hundred ninety nine"; 4.3 -> "four point three". */
export function numberToWords(value: number | string, lang: Lang): string {
  const raw = normalizeDigits(String(value)).replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return String(value);
  const [intPart, frac] = raw.split(".");
  if (intPart.length > 9 || (intPart.length > 1 && intPart.startsWith("0"))) {
    return spellDigits(raw, lang);
  }
  const words = intWords(Number(intPart), lang);
  if (frac === undefined) return words;
  return `${words} ${NUM[lang].point} ${spellDigits(frac, lang)}`;
}

/** Replace every number in a sentence with its words. Commas inside numbers are dropped first. */
export function digitsToWords(text: string, lang: Lang): string {
  return normalizeDigits(text).replace(/\d[\d,]*(?:\.\d+)?/g, (m) => {
    const cleaned = m.replace(/,+$/, "").replace(/,/g, "");
    const trailing = m.endsWith(",") ? "," : "";
    return numberToWords(cleaned, lang) + trailing;
  });
}

/* ------------------------------------------------------------------ *
 * Cleaning and splitting for text to speech
 * ------------------------------------------------------------------ */

export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * English product text: say units as words, and keep letters and digits apart so a voice does not read
 * "M35" as one odd word. "6000 mAh" is "6000 milliamp hours", "5G" is "5 G", "A15" is "A 15".
 */
function spellEnglishTerms(s: string): string {
  return s
    .replace(/\bmAh\b/g, "milliamp hours")
    .replace(/\bGB\b/g, "gigabytes")
    .replace(/\bTB\b/g, "terabytes")
    .replace(/\bMP\b/g, "megapixels")
    .replace(/\bANC\b/g, "noise cancelling")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
}

/**
 * Make one clause safe for the TTS service: no special characters, numbers as words.
 * The TTS service refuses special characters, so we keep only letters, marks, digits and spaces.
 */
export function cleanForTts(text: string, lang: Lang, digits: "words" | "digits" = DIGITS_MODE): string {
  let s = normalizeDigits(text);
  s = s.replace(/₹\s*(\d[\d,]*(?:\.\d+)?)/g, (_m, n: string) => `${n} ${NUM[lang].rupees}`);
  s = s.replace(/(\d)\s*%/g, (_m, n: string) => `${n} ${NUM[lang].percent}`);
  s = s.replace(/&/g, ` ${NUM[lang].and} `);
  s = s.replace(/['’‘`]/g, "");
  if (lang === "en") s = spellEnglishTerms(s);
  if (digits === "words") s = digitsToWords(s, lang);
  else s = s.replace(/(\d),(\d)/g, "$1$2");
  s = s.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

function hardSplit(words: string[], max: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i += max) out.push(words.slice(i, i + max).join(" "));
  return out;
}

function pack(units: string[], max: number): string[] {
  const out: string[] = [];
  let cur = "";
  let curWords = 0;
  for (const u of units) {
    const w = wordCount(u);
    if (cur && curWords + w > max) {
      out.push(cur);
      cur = "";
      curWords = 0;
    }
    cur = cur ? `${cur} ${u}` : u;
    curWords += w;
  }
  if (cur) out.push(cur);
  return out;
}

const SENTENCE_END = /(?<=[.!?।॥])\s+/u;

/**
 * Split text into chunks the TTS service accepts: each chunk is cleaned and has at most
 * `maxWords` words. Splits at sentence ends first, then at commas, then by word count.
 */
export function splitForSpeech(
  text: string,
  lang: Lang,
  maxWords: number = SPEECH_CHUNK_WORDS,
  digits: "words" | "digits" = DIGITS_MODE,
): string[] {
  const units: string[] = [];
  for (const sentence of text.split(SENTENCE_END)) {
    const whole = cleanForTts(sentence, lang, digits);
    if (!whole) continue;
    if (wordCount(whole) <= maxWords) {
      units.push(whole);
      continue;
    }
    for (const clause of sentence.split(/[,;:–—]+/)) {
      const c = cleanForTts(clause, lang, digits);
      if (!c) continue;
      if (wordCount(c) <= maxWords) units.push(c);
      else units.push(...hardSplit(c.split(/\s+/), maxWords));
    }
  }
  return pack(units, maxWords);
}

/** Split text for machine translation: sentence aware, each chunk at most 45 words. */
export function chunkForMt(text: string, maxWords: number = MT_CHUNK_WORDS): string[] {
  const units: string[] = [];
  for (const sentence of text.split(SENTENCE_END)) {
    const s = sentence.trim();
    if (!s) continue;
    if (wordCount(s) <= maxWords) units.push(s);
    else units.push(...hardSplit(s.split(/\s+/), maxWords));
  }
  return pack(units, maxWords);
}

/* ------------------------------------------------------------------ *
 * Number protection around translation
 * ------------------------------------------------------------------ */

const SIZE_TOKEN = /\b(?:XXS|XS|XL|XXL|XXXL)\b|\bsize\s+[SML]\b/g;

/** Numbers and size tokens found in a text, sorted, so two texts can be compared. */
export function protectedTokens(text: string): string[] {
  const t = normalizeDigits(text).replace(/(\d),(?=\d)/g, "$1");
  const nums = t.match(/\d+(?:\.\d+)?/g) ?? [];
  const sizes = (t.match(SIZE_TOKEN) ?? []).map((s) => s.replace(/\s+/g, " "));
  return [...nums, ...sizes].sort();
}

/** True when translation kept every number and size token exactly. */
export function numbersPreserved(source: string, translated: string): boolean {
  const a = protectedTokens(source);
  const b = protectedTokens(translated);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
