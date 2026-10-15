import { normalizeDigits } from "@/assistant/speakable";
import type { CategoryDef } from "@/contract";
import { emptyAction, type Action, type Category, type Pick3 } from "@/assistant/agent/schema";

/**
 * Keyword matcher. Used when the LLM is rate limited, down, or switched off (MOCK_LLM=1).
 * It is deliberately simple: it understands the common ways to say the common things.
 * It reads English best; it also knows the category words in Hindi and Telugu.
 */

export interface KeywordState {
  /** the shopper is looking at a product */
  hasProduct: boolean;
  /** options are on offer (1 to 3) */
  optionCount: number;
}

const STOPWORDS = new Set(
  (
    "a an the i me my we you your is are am was be to for of in on at it its this that these those and or but with without please " +
    "want need looking look find show give get buy some any good best nice under below above over less more than rupees rupee rs " +
    "within upto up max maximum at least cheap cheaper cheapest option options one two three first second third can could would should " +
    "tell about hear what which who how do does did will has have there here also just like"
  ).split(" "),
);

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/** "fifteen hundred" -> 1500, "two thousand five hundred" -> 2500. Returns null when no number words are found. */
export function spokenEnglishNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (w in ONES) {
      current += ONES[w];
      seen = true;
    } else if (w === "hundred") {
      current = (current || 1) * 100;
      seen = true;
    } else if (w === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (w === "lakh") {
      total += (current || 1) * 100000;
      current = 0;
      seen = true;
    } else if (seen) {
      break;
    }
  }
  return seen ? total + current : null;
}

function findMaxPrice(t: string): number | null {
  const digits = t.match(/(?:under|below|less than|within|upto|up to|max(?:imum)?|at most|around|about)\s*(?:rs\.?|rupees?|₹)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh)?/);
  if (digits) return Number(digits[1]) * (digits[2] === "k" || digits[2] === "thousand" ? 1000 : digits[2] === "lakh" ? 100000 : 1);
  const m = t.match(/(?:under|below|less than|within|upto|up to|max(?:imum)?|at most)\s+((?:[a-z]+\s*){1,4})/);
  if (m) {
    const n = spokenEnglishNumber(m[1].trim().split(/\s+/));
    if (n) return n;
  }
  return null;
}

function findPick(t: string): Pick3 | null {
  if (/\b(first|1st|number one|option one|option 1|top one)\b/.test(t)) return 1;
  if (/\b(second|2nd|number two|option two|option 2)\b/.test(t)) return 2;
  if (/\b(third|3rd|number three|option three|option 3|last one)\b/.test(t)) return 3;
  return null;
}

/** Telugu and Hindi are often typed with invisible joiners (ZWNJ, ZWJ); they must not split a word. */
const noJoiners = (s: string) => s.replace(/[\u200c\u200d]/g, "");

/** Which category a sentence is about, from the words the store gives for each in meta(). */
export function findCategory(t: string, categories: Pick<CategoryDef, "id" | "words">[]): Category | null {
  const text = noJoiners(t);
  for (const cat of categories) {
    if (cat.words.some((w) => (/^[a-z]+$/.test(w) ? new RegExp(`\\b${w}(?:s|es)?\\b`).test(text) : text.includes(noJoiners(w))))) return cat.id;
  }
  return null;
}

function has(t: string, re: RegExp): boolean {
  return re.test(t);
}

export function keywordAction(input: string, state: KeywordState, categories: Pick<CategoryDef, "id" | "words">[]): Action {
  const t = noJoiners(normalizeDigits(input)).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s.₹]/gu, " ").replace(/\s+/g, " ").trim();
  const pick = findPick(t);
  const category = findCategory(t, categories);

  if (has(t, /\b(medicine|medicines|doctor|tablet|loan|invest|investment|insurance|lawyer|legal|court|prescription)\b/)) {
    return emptyAction("out_of_scope");
  }
  if (has(t, /\b(where am i|what screen|what page)\b/)) return emptyAction("where_am_i");
  if (has(t, /\b(help|what can you do|how do i)\b/)) return emptyAction("help");
  if (has(t, /\b(repeat|say that again|say again|once more)\b/)) return emptyAction("repeat");
  if (has(t, /\b(change (?:the )?filters?|different filters?|new filters?)\b/)) return emptyAction("change_filters");
  if (has(t, /\b(go back|back|previous|start over)\b/)) return emptyAction("go_back");

  if (has(t, /\b(track|my orders?|where is my order|order status|delivery status)\b/)) return emptyAction("track_order");
  if (has(t, /\b(return|refund|send back)\b/)) return { ...emptyAction("return_order") };

  if (has(t, /\b(check ?out|pay|place (?:my |the )?order|proceed to (?:pay|buy))\b/)) {
    const a = emptyAction("checkout");
    if (has(t, /\b(cash on delivery|cod|cash)\b/)) a.payment = "cod";
    else if (has(t, /\b(online|upi|card)\b/)) a.payment = "online";
    return a;
  }
  if (has(t, /\b(remove|delete|take out)\b/)) return { ...emptyAction("remove_from_cart"), pick };
  if (has(t, /\b(add|buy|purchase|take)\b/) && (state.hasProduct || state.optionCount > 0 || pick) && !category) {
    return {
      ...emptyAction("add_to_cart"),
      pick,
      quantity: (() => {
        const q = t.match(/\b(\d+)\s*(?:pieces?|items?|of them)\b/);
        return q ? Number(q[1]) : null;
      })(),
    };
  }
  if (has(t, /\b(cart|basket|what have i added)\b/)) return emptyAction("read_cart");
  if (has(t, /\b(compare|difference between|which is better|versus|vs)\b/)) {
    return { ...emptyAction("compare"), pick: pick ?? 1, pick2: pick ? (pick === 1 ? 2 : 1) : 2 };
  }
  if (has(t, /\b(deliver(?:y|ed)?|arrive|arrives|reach|when will|how long|shipping|ship|dispatch)\b|डिलीवरी|कब (?:तक )?(?:आएगा|पहुँचेगा|पहुंचेगा|मिलेगा)|డెలివరీ|ఎప్పుడు (?:వస్తుంది|చేరుతుంది)/)) return { ...emptyAction("delivery_info"), pick };
  if (has(t, /\b(reviews?|ratings?|feedback|what (?:do )?people say|opinions?|pros|cons)\b/)) return { ...emptyAction("reviews"), pick };
  if (has(t, /\b(photo|picture|image|look like|looks like|colou?r|what does it look)\b/) && !category) return { ...emptyAction("describe_photo"), pick };
  if (has(t, /\b(size|sizes|size chart|fit|measurements?)\b/) && state.hasProduct) return { ...emptyAction("size_help"), pick };
  if (has(t, /\b(simpl(?:e|er|y)|easy words|explain|what does that mean|meaning)\b/)) return emptyAction("explain_simpler");
  if (has(t, /\b(key facts|top facts|features|specs?|specifications|details|tell me about|about (?:this|it))\b/)) return { ...emptyAction("top_facts"), pick };
  if (has(t, /\b(show (?:me )?(?:the )?(?:matches|results|best)|best (?:ones|matches)|that is enough|enough)\b/)) return emptyAction("show_matches");

  if (pick && state.optionCount > 0 && !category) return { ...emptyAction("open"), pick };

  if (state.hasProduct && has(t, /(^|\s)(does|is|are|can|will|how|what|which|do|has|have)\b|\?/)) {
    return { ...emptyAction("ask_product"), question: input.trim().slice(0, 200) };
  }

  const maxPrice = findMaxPrice(t);
  const words = t.split(" ").filter((w) => w && !STOPWORDS.has(w) && !/^\d+(\.\d+)?$/.test(w) && !(w in ONES) && w !== "hundred" && w !== "thousand" && w !== "lakh");
  const kw = words.slice(0, 5).join(" ");

  if (category) {
    return {
      ...emptyAction("search"),
      category,
      max_price: maxPrice,
      min_rating: has(t, /\b(top rated|best rated|highly rated|good rating)\b/) ? 4 : null,
      keywords: kw || null,
      sort: has(t, /\b(cheap|cheapest|lowest price|low price)\b/) ? "price_low" : has(t, /\b(best seller|bestseller|popular)\b/) ? "popular" : null,
    };
  }
  return { ...emptyAction("clarify"), clarify: "What would you like to buy?" };
}
