import type { Lang } from "@/contract/lang";
import { normalizeDigits } from "@/assistant/speakable";

/**
 * Word lists for the commands every shopper says all the time.
 * Matching them here, before translation, saves a translation call, an LLM call and a second or two.
 * Hindi lists include Hinglish (Latin script); Telugu lists include Latin spelling.
 * A native speaker should read the Hindi and Telugu lists once.
 */

export type Cmd =
  | "yes" | "no" | "cancel" | "repeat" | "slower" | "faster" | "what" | "stop" | "back"
  | "first" | "second" | "third" | "help" | "whereami" | "startover" | "simpler" | "skip" | "filters";

type Lists = Record<Cmd, string[]>;

const EN: Lists = {
  yes: ["yes", "yeah", "yep", "yup", "ok", "okay", "sure", "correct", "right", "that is right", "thats right", "that is correct", "go ahead", "please do"],
  no: ["no", "nope", "not", "dont", "wrong", "incorrect", "not now", "never mind", "nevermind"],
  cancel: ["cancel", "cancelled", "dont order", "do not order"],
  repeat: ["repeat", "again", "say that again", "say again", "once more", "repeat that", "can you repeat"],
  slower: ["slower", "slow down", "slowly", "too fast", "speak slowly", "slow"],
  faster: ["faster", "speed up", "quicker", "too slow"],
  what: ["what", "huh", "pardon", "sorry", "come again", "i did not understand", "i didnt understand"],
  stop: ["stop", "quiet", "silence", "enough", "pause", "shut up", "be quiet"],
  back: ["back", "go back", "previous", "go to previous"],
  first: ["first", "first one", "1st", "number one", "option one", "the first"],
  second: ["second", "second one", "2nd", "number two", "option two", "the second"],
  third: ["third", "third one", "3rd", "number three", "option three", "the third"],
  help: ["help", "what can you do", "how does this work", "what can i say"],
  whereami: ["where am i", "what page is this", "what screen is this", "where are we"],
  startover: ["start over", "restart", "begin again", "reset", "start again"],
  skip: ["skip", "skip it", "any", "anything", "any one", "doesnt matter", "does not matter", "no preference", "whatever", "dont mind", "pass", "next question", "not sure", "dont know"],
  filters: ["change filters", "change the filters", "new filters", "different filters", "reset filters", "start the filters again", "filters"],
  simpler: ["explain simpler", "simpler", "in simple words", "simple words", "make it simple", "explain simply", "explain in simple words", "easier words"],
};

const HI: Lists = {
  yes: ["हाँ", "हां", "जी", "जी हाँ", "जी हां", "ठीक है", "सही है", "सही", "बिल्कुल", "haan", "han", "ji", "ji haan", "theek hai", "sahi hai", "yes", "ok", "okay"],
  no: ["नहीं", "नही", "ना", "गलत", "ग़लत", "मत", "नहीं चाहिए", "nahi", "nahin", "na", "galat", "mat", "no"],
  cancel: ["रद्द", "रद्द करो", "कैंसिल", "कैंसल", "cancel", "mat karo"],
  repeat: ["दोहराओ", "दोहराइए", "फिर से", "दोबारा", "एक बार और", "फिर बोलो", "फिर से बोलो", "dobara", "phir se", "phir bolo", "repeat", "dohrao"],
  slower: ["धीरे", "धीमा", "धीरे बोलो", "धीरे बोलिए", "dheere", "dheere bolo", "slow", "slower"],
  faster: ["तेज़", "तेज", "जल्दी बोलो", "tez", "tez bolo", "faster"],
  what: ["क्या", "क्या कहा", "क्या बोला", "फिर से क्या", "kya", "kya kaha", "kya bola", "what"],
  stop: ["रुको", "रुकिए", "बस", "चुप", "रुक जाओ", "ruko", "bas", "chup", "stop"],
  back: ["पीछे", "वापस", "पीछे जाओ", "peeche", "wapas", "peeche jao", "back"],
  first: ["पहला", "पहली", "पहले", "पहला वाला", "एक नंबर", "pehla", "pehle", "pehla wala", "first"],
  second: ["दूसरा", "दूसरी", "दूसरे", "दूसरा वाला", "doosra", "dusra", "doosra wala", "second"],
  third: ["तीसरा", "तीसरी", "तीसरे", "तीसरा वाला", "teesra", "teesra wala", "third"],
  help: ["मदद", "सहायता", "मदद करो", "क्या कर सकते हो", "madad", "madad karo", "help"],
  whereami: ["मैं कहाँ हूँ", "मैं कहां हूं", "मैं कहाँ हूं", "कौन सा पेज है", "main kahan hoon", "kahan hoon"],
  startover: ["फिर से शुरू", "शुरू से", "दोबारा शुरू", "shuru se", "phir se shuru", "restart"],
  skip: ["छोड़ो", "छोड़ दो", "कोई भी", "कोई भी चलेगा", "कुछ भी", "फ़र्क नहीं पड़ता", "फर्क नहीं पड़ता", "पता नहीं", "koi bhi", "chhodo", "kuch bhi", "skip"],
  filters: ["फ़िल्टर बदलो", "फिल्टर बदलो", "फ़िल्टर", "फिल्टर", "filter badlo", "filter"],
  simpler: ["आसान भाषा", "आसान शब्दों में", "सरल भाषा", "आसान करके बताओ", "आसान शब्दों में बताओ", "simple", "simple words", "aasan bhasha"],
};

const TE: Lists = {
  yes: ["అవును", "ఔను", "అవునండి", "సరే", "సరేనండి", "సరైనది", "కరెక్ట్", "avunu", "sare", "yes", "ok", "okay"],
  no: ["కాదు", "వద్దు", "లేదు", "తప్పు", "kaadu", "vaddu", "ledu", "no"],
  cancel: ["రద్దు", "రద్దు చేయండి", "క్యాన్సిల్", "cancel", "vaddu"],
  repeat: ["మళ్ళీ", "మళ్లీ", "మరోసారి", "మళ్ళీ చెప్పండి", "మళ్లీ చెప్పండి", "malli", "malli cheppandi", "repeat"],
  slower: ["నెమ్మదిగా", "నెమ్మది", "నెమ్మదిగా చెప్పండి", "nemmadiga", "slow", "slower"],
  faster: ["వేగంగా", "త్వరగా", "vegamga", "faster"],
  what: ["ఏమిటి", "ఏంటి", "ఏమిటండి", "ఏమన్నారు", "emiti", "enti", "what"],
  stop: ["ఆపండి", "ఆపు", "చాలు", "ఆగండి", "aapandi", "aapu", "chalu", "stop"],
  back: ["వెనక్కి", "వెనుకకు", "వెనక్కి వెళ్ళండి", "venakki", "back"],
  first: ["మొదటి", "మొదటిది", "మొదటి ఒకటి", "modati", "modatidi", "first"],
  second: ["రెండవ", "రెండవది", "రెండోది", "రెండో", "rendava", "rendodi", "second"],
  third: ["మూడవ", "మూడవది", "మూడోది", "మూడో", "moodava", "moododi", "third"],
  help: ["సహాయం", "సహాయం చేయండి", "ఏం చేయగలరు", "sahayam", "help"],
  whereami: ["నేను ఎక్కడ ఉన్నాను", "ఇది ఏ పేజీ", "nenu ekkada unnanu"],
  startover: ["మళ్ళీ మొదలు", "మొదటి నుండి", "మళ్ళీ మొదలుపెట్టండి", "modati nundi", "restart"],
  skip: ["ఏదైనా", "పర్వాలేదు", "వదిలేయండి", "తెలియదు", "edaina", "parvaledu", "skip"],
  filters: ["ఫిల్టర్లు మార్చండి", "ఫిల్టర్", "ఫిల్టర్లు", "filter", "filters"],
  simpler: ["సులభంగా చెప్పండి", "సరళంగా", "సులభమైన మాటల్లో", "simple", "simple words", "sulabhamga"],
};

const LISTS: Record<Lang, Lists> = { en: EN, hi: HI, te: TE };

/** Words that mean "order" in each language, used by the checkout confirm rule. */
const ORDER_WORDS: string[] = ["order", "ऑर्डर", "आर्डर", "ऑडर", "ఆర్డర్", "ఆర్డరు", "orderu"];

/* ---------------- matching ---------------- */

export function tokenize(text: string): string[] {
  return (
    normalizeDigits(text)
      .toLowerCase()
      .replace(/['’‘`]/g, "")
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  );
}

function norm(phrase: string): string {
  return ` ${tokenize(phrase).join(" ")} `;
}

const CACHE = new Map<string, string[]>();
function phrases(lang: Lang, cmd: Cmd): string[] {
  const key = `${lang}:${cmd}`;
  let v = CACHE.get(key);
  if (!v) {
    const merged = lang === "en" ? LISTS.en[cmd] : [...LISTS[lang][cmd], ...LISTS.en[cmd]];
    v = merged.map(norm);
    CACHE.set(key, v);
  }
  return v;
}

/** True when the sentence contains any phrase of this command (whole words, any position). */
export function has(text: string, cmd: Cmd, lang: Lang): boolean {
  const hay = ` ${tokenize(text).join(" ")} `;
  return phrases(lang, cmd).some((p) => p.trim() !== "" && hay.includes(p));
}

/** Longest match first, so "go back" is not mistaken for something shorter. */
const ORDER: Cmd[] = [
  "whereami", "startover", "filters", "simpler", "help", "slower", "faster", "repeat", "stop", "back", "cancel", "skip",
  "first", "second", "third", "what", "no", "yes",
];

/**
 * A short sentence that is only a command. Longer sentences go to the LLM so that
 * "yes, show me the second cooker" is not read as a bare yes.
 */
export function matchCommand(text: string, lang: Lang, opts: { hasOptions: boolean } = { hasOptions: false }): Cmd | null {
  const toks = tokenize(text);
  if (toks.length === 0 || toks.length > 4) return null;
  for (const cmd of ORDER) {
    if ((cmd === "first" || cmd === "second" || cmd === "third") && !opts.hasOptions) continue;
    if (has(text, cmd, lang)) return cmd;
  }
  return null;
}

/* ---------------- checkout confirm ---------------- */

export type Confirm = "confirm" | "cancel" | "other";

/**
 * The only way to place an order by voice: a yes AND an order word, and nothing negative.
 * "yes" alone, "maybe", "ok" alone and silence are all "other".
 */
export function checkConfirm(text: string, lang: Lang): Confirm {
  const toks = tokenize(text);
  if (toks.length === 0) return "other";
  const neg = has(text, "no", lang) || has(text, "cancel", lang);
  if (neg) return "cancel";
  const yes = has(text, "yes", lang);
  const hay = ` ${toks.join(" ")} `;
  const order = ORDER_WORDS.some((w) => hay.includes(` ${w} `));
  return yes && order ? "confirm" : "other";
}

/* ---------------- language commands ---------------- */

const LANG_NAMES: Record<Lang, string[]> = {
  en: ["english", "अंग्रेज़ी", "अंग्रेजी", "इंग्लिश", "ఇంగ్లీష్", "angrezi"],
  hi: ["hindi", "हिंदी", "हिन्दी", "హిందీ", "हिंदी में"],
  te: ["telugu", "तेलुगु", "तेलुगू", "తెలుగు", "తెలుగులో", "telugu mein"],
};
const REPLY_WORDS = ["reply", "answer", "respond", "जवाब", "उत्तर", "jawab", "సమాధానం", "జవాబు", "samadhanam"];

export interface LangCommand {
  lang: Lang;
  /** "reply in Telugu": change only the language we speak back */
  replyOnly: boolean;
}

export function detectLanguageCommand(text: string): LangCommand | null {
  const toks = tokenize(text);
  if (toks.length === 0 || toks.length > 8) return null;
  const hay = ` ${toks.join(" ")} `;
  for (const lang of ["en", "hi", "te"] as Lang[]) {
    if (LANG_NAMES[lang].some((n) => hay.includes(norm(n)))) {
      const replyOnly = REPLY_WORDS.some((w) => hay.includes(norm(w)));
      return { lang, replyOnly };
    }
  }
  return null;
}
