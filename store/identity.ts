import type { L3 } from "@/contract/lang";
import type { Category } from "@/contract";

/** Who this store is, as it tells the assistant in meta(). */

export const STORE_NAME: L3 = { en: "Haat", hi: "हाट", te: "హాట్" };

export const STORE_ADDRESS: { short: L3; full: L3 } = {
  short: { en: "12 Rose Lane, Hyderabad", hi: "12 रोज़ लेन, हैदराबाद", te: "12 రోజ్ లేన్, హైదరాబాద్" },
  full: {
    en: "12 Rose Lane, Hyderabad. This is the demo address.",
    hi: "12 रोज़ लेन, हैदराबाद। यह डेमो पता है।",
    te: "12 రోజ్ లేన్, హైదరాబాద్. ఇది డెమో చిరునామా.",
  },
};

/** Words that mean each category, in English, Hindi and Telugu (lower case, as people say them). */
export const CATEGORY_WORDS: Record<Category, string[]> = {
  phones: ["phone", "mobile", "smartphone", "cellphone", "फ़ोन", "फोन", "मोबाइल", "स्मार्टफ़ोन", "स्मार्टफोन", "ఫోన్", "మొబైల్", "స్మార్ట్ఫోన్"],
  jeans: ["jean", "jeans", "denim", "जींस", "जीन्स", "జీన్స్"],
  cookers: ["cooker", "pressure", "कुकर", "प्रेशर", "కుక్కర్", "ప్రెషర్"],
  earbuds: ["earbud", "earbuds", "earphone", "earphones", "airpod", "airpods", "buds", "bluetooth", "headphone", "headphones", "headset", "ईयरबड्स", "ईयरफ़ोन", "ईयरफोन", "एयरपॉड्स", "ब्लूटूथ", "ఇయర్బడ్స్", "ఇయర్ఫోన్", "ఎయిర్పాడ్స్", "బ్లూటూత్"],
  shoes: ["shoe", "shoes", "sneaker", "sneakers", "footwear", "trainers", "जूते", "जूता", "जूतों", "बूट", "బూట్లు", "బూటు", "షూస్"],
};

/** Which category a few typed words point to, for the header search ("samsung phone"). */
export function findCategory(text: string): Category | null {
  const t = text.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((w) => (/^[a-z]+$/.test(w) ? new RegExp(`\b${w}(?:s|es)?\b`).test(t) : t.includes(w)))) return cat;
  }
  return null;
}
