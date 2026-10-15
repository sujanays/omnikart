import type { L3, Lang } from "@/contract/lang";
import type { Category } from "@/contract";
import type { AccessReview, AttrValue, Product, Review } from "@/store/catalogue-types";
import { ASPECT_SUMMARY, COLOUR, VALUE, type AspectKey } from "@/store/content/dictionary";
import { buildName } from "@/store/content/naming";
import { specsFor } from "@/store/content/specs";

/** One product as written by hand. Everything else (title, specs, picture text, reviews) is built from it. */
export interface Seed {
  id: string;
  brand: string;
  model: string;
  modelHi?: string;
  modelTe?: string;
  price: number;
  mrp: number;
  ratingCount: number;
  stock: number;
  deliveryDays: number;
  seller: string;
  returnDays: number;
  attrs: Record<string, AttrValue>;
  /** quality from 0.5 (weak) to 0.95 (excellent). Drives the reviews, so ratings and complaints agree. */
  q: number;
  hero?: boolean;
  bestSeller?: boolean;
  choice?: boolean;
  touch?: boolean;
  access?: AccessReview[];
  keywords?: string[];
}

/* ---------------- seeded random ---------------- */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- review phrase banks ---------------- */
const HINGLISH: Record<AspectKey, { pos: string; neg: string }> = {
  build: { pos: "build ekdum mazboot hai", neg: "build thodi kamzor hai" },
  handle: { pos: "handle garam nahi hota, pakadna aasan hai", neg: "handle garam ya dheela ho jaata hai" },
  value: { pos: "paisa vasool hai", neg: "price ke hisaab se thoda mehenga hai" },
  size: { pos: "size ekdum sahi hai", neg: "size expect se chhota hai" },
  safety: { pos: "dhakkan tight band hota hai, safe lagta hai", neg: "dhakkan band karna mushkil hai" },
  cleaning: { pos: "saaf karna easy hai", neg: "saaf karna mushkil hai" },
  battery: { pos: "battery bahut chalti hai", neg: "battery jaldi khatam hoti hai" },
  camera: { pos: "photo clear aati hai", neg: "kam roshni mein photo dull aati hai" },
  screen: { pos: "screen bright hai aur padhna easy hai", neg: "dhoop mein screen padhna mushkil hai" },
  speed: { pos: "bina atke chalta hai", neg: "kabhi kabhi hang ho jaata hai" },
  sound: { pos: "awaaz clear hai", neg: "awaaz kamzor hai" },
  fit: { pos: "fitting achhi hai", neg: "fitting theek nahi, size chart dekhna" },
  fabric: { pos: "kapda soft aur comfortable hai", neg: "kapda thoda rough hai" },
  colour: { pos: "colour photo jaisa hi hai", neg: "colour photo se alag hai" },
  wash: { pos: "dhone ke baad colour nahi jaata", neg: "dhone ke baad colour fade ho jaata hai" },
  noise: { pos: "awaaz bahut kam karta hai", neg: "awaaz karta hai" },
  brightness: { pos: "roshni tez hai", neg: "roshni kam hai" },
  delivery: { pos: "time par pahunch gaya", neg: "der se aaya" },
  packing: { pos: "packing achhi thi", neg: "packing theek nahi thi" },
  airflow: { pos: "hawa achhi deta hai", neg: "hawa kam aati hai" },
  anc: { pos: "noise cancelling achhi hai", neg: "noise cancelling kamzor hai" },
  comfort: { pos: "ghanton pehanne mein comfortable hai", neg: "thodi der baad uncomfortable lagta hai" },
  connect: { pos: "jaldi connect hota hai", neg: "beech beech mein disconnect hota hai" },
  calls: { pos: "call clear aati hai", neg: "saamne wale ko awaaz kam aati hai" },
  grip: { pos: "gile floor par achhi pakad hai", neg: "gile floor par phisalta hai" },
  looks: { pos: "dekhne mein achha lagta hai", neg: "saamne se saadharan dikhta hai" },
};

const EN_PREFIX = ["", "", "Honestly, ", "Used it for a month: ", "Quick note: "];
const EN_CLOSE = {
  pos: ["Happy with the purchase.", "Would recommend.", "Worth it.", ""],
  neg: ["Expected better.", "Not happy.", "Hope they improve this.", ""],
};
const HI_CLOSE = { pos: ["बहुत बढ़िया।", "लेने लायक है।", ""], neg: ["उम्मीद थी इससे बेहतर होगा।", "थोड़ी निराशा हुई।", ""] };
const HL_CLOSE = { pos: ["Lena chahiye.", "Achha product hai.", ""], neg: ["Expect achha tha.", "Thoda nirash hua.", ""] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

interface Mix {
  aspect: AspectKey;
  share: number;
  /** chance a mention is praise, for a product of quality 0.75 */
  pos: number;
}

/** What buyers of each kind of product write about. */
export const MIXES: Record<Category, Mix[]> = {
  phones: [
    { aspect: "battery", share: 0.25, pos: 0.8 },
    { aspect: "camera", share: 0.2, pos: 0.6 },
    { aspect: "screen", share: 0.15, pos: 0.8 },
    { aspect: "speed", share: 0.15, pos: 0.75 },
    { aspect: "value", share: 0.15, pos: 0.8 },
    { aspect: "sound", share: 0.05, pos: 0.6 },
    { aspect: "delivery", share: 0.05, pos: 0.9 },
  ],
  jeans: [
    { aspect: "fit", share: 0.3, pos: 0.7 },
    { aspect: "fabric", share: 0.25, pos: 0.8 },
    { aspect: "comfort", share: 0.15, pos: 0.8 },
    { aspect: "colour", share: 0.1, pos: 0.75 },
    { aspect: "wash", share: 0.1, pos: 0.65 },
    { aspect: "value", share: 0.1, pos: 0.8 },
  ],
  cookers: [
    { aspect: "build", share: 0.25, pos: 0.85 },
    { aspect: "handle", share: 0.15, pos: 0.6 },
    { aspect: "safety", share: 0.15, pos: 0.8 },
    { aspect: "value", share: 0.2, pos: 0.8 },
    { aspect: "size", share: 0.1, pos: 0.7 },
    { aspect: "cleaning", share: 0.15, pos: 0.75 },
  ],
  earbuds: [
    { aspect: "sound", share: 0.25, pos: 0.7 },
    { aspect: "battery", share: 0.2, pos: 0.75 },
    { aspect: "connect", share: 0.15, pos: 0.75 },
    { aspect: "comfort", share: 0.15, pos: 0.7 },
    { aspect: "anc", share: 0.1, pos: 0.6 },
    { aspect: "calls", share: 0.1, pos: 0.6 },
    { aspect: "value", share: 0.05, pos: 0.85 },
  ],
  shoes: [
    { aspect: "comfort", share: 0.3, pos: 0.75 },
    { aspect: "grip", share: 0.15, pos: 0.7 },
    { aspect: "fit", share: 0.15, pos: 0.65 },
    { aspect: "looks", share: 0.15, pos: 0.8 },
    { aspect: "build", share: 0.15, pos: 0.7 },
    { aspect: "value", share: 0.1, pos: 0.8 },
  ],
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function makeReviews(seed: Seed, category: Category, n: number): Review[] {
  const rand = rng(hash(seed.id));
  // noise cancelling is only talked about on products that have it
  const mix = MIXES[category]
    .filter((m) => !(m.aspect === "anc" && !seed.attrs.anc))
    .map((m) => ({ ...m, pos: clamp(m.pos + (seed.q - 0.75) * 0.9, 0.15, 0.97) }));
  const total = mix.reduce((s, m) => s + m.share, 0);
  const tone = 3.0 + seed.q * 1.6;
  const langMix: [number, number] = seed.hero ? [0.5, 0.2] : [0.6, 0.15];

  const pickAspect = (not?: AspectKey) => {
    for (let guard = 0; guard < 20; guard++) {
      let r = rand() * total;
      for (const m of mix) {
        r -= m.share;
        if (r <= 0) {
          if (m.aspect !== not) return m;
          break;
        }
      }
    }
    return mix.find((m) => m.aspect !== not) ?? mix[0];
  };
  const pickFrom = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const out: Review[] = [];
  for (let i = 0; i < n; i++) {
    const first = pickAspect();
    const aspects: { aspect: AspectKey; pol: 1 | -1 }[] = [{ aspect: first.aspect, pol: rand() < first.pos ? 1 : -1 }];
    if (rand() < 0.45) {
      const second = pickAspect(first.aspect);
      aspects.push({ aspect: second.aspect, pol: rand() < second.pos ? 1 : -1 });
    }
    const net = aspects.reduce((s, a) => s + a.pol, 0);
    let s = tone + aspects.reduce((sum, a) => sum + (a.pol > 0 ? 0.45 : -1.5), 0) + (rand() - 0.5) * 0.8;
    s = clamp(Math.round(s), 1, 5);
    const r = rand();
    const lang: Review["lang"] = r < langMix[0] ? "en" : r < langMix[0] + langMix[1] ? "hi" : "hinglish";
    const closeKey = net >= 0 ? "pos" : "neg";

    const parts = aspects.map((a, idx) => {
      const key = a.pol > 0 ? "pos" : "neg";
      const base = lang === "en" ? ASPECT_SUMMARY[a.aspect][key].en : lang === "hi" ? ASPECT_SUMMARY[a.aspect][key].hi : HINGLISH[a.aspect][key];
      if (idx === 0) return base;
      const contrast = a.pol !== aspects[0].pol;
      if (lang === "en") return (contrast ? "But " : "Also, ") + low(base);
      if (lang === "hi") return (contrast ? "लेकिन " : "और ") + base;
      return (contrast ? "lekin " : "aur ") + base;
    });

    let text: string;
    if (lang === "en") {
      const prefix = pickFrom(EN_PREFIX);
      const head = prefix ? prefix + low(parts[0]) : cap(parts[0]);
      text = [head, ...parts.slice(1)].join(". ") + ". " + pickFrom(EN_CLOSE[closeKey]);
    } else if (lang === "hi") {
      text = parts.join("। ") + "। " + pickFrom(HI_CLOSE[closeKey]);
    } else {
      text = cap(parts[0]) + (parts.length > 1 ? ", " + parts.slice(1).join(", ") : "") + ". " + pickFrom(HL_CLOSE[closeKey]);
    }
    out.push({ id: `${seed.id}-r${i + 1}`, lang, stars: s as Review["stars"], text: text.replace(/\s+/g, " ").trim(), aspects });
  }
  return out;
}

/** Share of ratings for 5, 4, 3, 2, 1 stars, in whole percent, adding to exactly 100. */
export function histogramOf(reviews: Review[]): [number, number, number, number, number] {
  const counts = [5, 4, 3, 2, 1].map((s) => reviews.filter((r) => r.stars === s).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const pct = counts.map((c) => Math.round((c / total) * 100));
  const diff = 100 - pct.reduce((a, b) => a + b, 0);
  const biggest = pct.indexOf(Math.max(...pct));
  pct[biggest] += diff;
  return pct as [number, number, number, number, number];
}

/* ---------------- what the photo shows, in words ---------------- */
/** Hindi colour words take the "-e" form before "रंग": नीला becomes नीले. */
const obl = (w: string) => w.replace(/ा(?=\s|$)/g, "े");
const colourOf = (a: Record<string, AttrValue>, lang: Lang) => (COLOUR[String(a.colour)]?.[lang] ?? "").toLowerCase();

export function lookFor(category: Category, a: Record<string, AttrValue>): L3 {
  const g = a.gender === "women";
  switch (category) {
    case "phones": {
      const lenses = (a.camera as number) >= 100 ? 3 : 2;
      return {
        en: `A ${colourOf(a, "en")} smartphone. From the front it has a ${a.screen} inch screen with thin borders and a small camera hole at the top. The back has a camera block with ${lenses} lenses.`,
        hi: `${obl(colourOf(a, "hi"))} रंग का स्मार्टफ़ोन। सामने ${a.screen} इंच की स्क्रीन है, पतले किनारे और ऊपर छोटा कैमरा छेद। पीछे ${lenses} लेंस वाला कैमरा ब्लॉक है।`,
        te: `${colourOf(a, "te")} రంగు స్మార్ట్‌ఫోన్. ముందు ${a.screen} అంగుళాల స్క్రీన్, సన్నని అంచులు, పైన చిన్న కెమెరా రంధ్రం. వెనుక ${lenses} లెన్స్‌ల కెమెరా బ్లాక్ ఉంది.`,
      };
    }
    case "jeans":
      return {
        en: `${g ? "Women's" : "Men's"} ${a.fit} fit jeans in ${colourOf(a, "en")}, with five pockets, a metal button and a zip.`,
        hi: `${obl(colourOf(a, "hi"))} रंग की ${g ? "महिलाओं की" : "पुरुषों की"} ${VALUE[String(a.fit)].hi} फ़िट जींस, पाँच जेबें, धातु का बटन और ज़िप।`,
        te: `${colourOf(a, "te")} రంగు ${g ? "మహిళల" : "పురుషుల"} ${VALUE[String(a.fit)].te} ఫిట్ జీన్స్, ఐదు జేబులు, లోహపు బటన్, జిప్.`,
      };
    case "cookers": {
      const m = VALUE[String(a.material)];
      return {
        en: `${/^[aeiou]/i.test(m.en) ? "An" : "A"} ${m.en.toLowerCase()} pressure cooker that holds ${a.capacity} litres, with a ${a.lid === "inner" ? "lid that fits inside the pot" : "lid that sits over the pot"}, a handle on each side and a steam valve on top.`,
        hi: `${a.capacity} लीटर का ${m.hi} प्रेशर कुकर, ${a.lid === "inner" ? "बर्तन के अंदर बैठने वाला ढक्कन" : "बर्तन के ऊपर बैठने वाला ढक्कन"}, दोनों तरफ़ हैंडल और ऊपर भाप का वाल्व।`,
        te: `${a.capacity} లీటర్ల ${m.te} ప్రెషర్ కుక్కర్, ${a.lid === "inner" ? "గిన్నె లోపల కూర్చునే మూత" : "గిన్నె పైన కూర్చునే మూత"}, రెండు వైపులా హ్యాండిళ్లు, పైన ఆవిరి వాల్వ్.`,
      };
    }
    case "earbuds":
      return {
        en: `A pair of ${colourOf(a, "en")} wireless earbuds with short stems, resting in a ${colourOf(a, "en")} charging case${a.anc ? ". They have noise cancelling" : ""}.`,
        hi: `${obl(colourOf(a, "hi"))} रंग के वायरलेस ईयरबड्स की जोड़ी, छोटी डंडी के साथ, ${colourOf(a, "hi")} चार्जिंग केस में${a.anc ? "। इनमें शोर रद्द करने की सुविधा है" : ""}।`,
        te: `${colourOf(a, "te")} రంగు వైర్‌లెస్ ఇయర్‌బడ్స్ జత, చిన్న కాడలతో, ${colourOf(a, "te")} ఛార్జింగ్ కేస్‌లో${a.anc ? ". వీటిలో శబ్దం రద్దు సదుపాయం ఉంది" : ""}.`,
      };
    case "shoes": {
      const type = VALUE[String(a.type)];
      return {
        en: `${g ? "Women's" : "Men's"} ${type.en.toLowerCase()} shoes in ${colourOf(a, "en")}, ${a.closure === "slipOn" ? "with no laces, you slip them on" : "with laces"}, on a cushioned sole.`,
        hi: `${obl(colourOf(a, "hi"))} रंग के ${g ? "महिलाओं के" : "पुरुषों के"} ${type.hi} जूते, ${a.closure === "slipOn" ? "बिना फीते के, सीधे पहनें" : "फीतों के साथ"}, गद्देदार तलवे पर।`,
        te: `${colourOf(a, "te")} రంగు ${g ? "మహిళల" : "పురుషుల"} ${type.te} బూట్లు, ${a.closure === "slipOn" ? "లేసులు లేకుండా, నేరుగా వేసుకోవచ్చు" : "లేసులతో"}, మెత్తని అడుగుతో.`,
      };
    }
    default:
      return { en: "", hi: "", te: "" };
  }
}

/** The finished product from a seed. */
export function productFrom(seed: Seed, category: Category, files: { photo: string; gallery: string[] }): Product {
  const n = seed.hero ? 52 + (hash(seed.id) % 11) : 8 + (hash(seed.id) % 5);
  const reviews = makeReviews(seed, category, n);
  const avg = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  return {
    id: seed.id,
    category,
    brand: seed.brand,
    model: seed.model,
    name: buildName({ category, brand: seed.brand, model: seed.model, attrs: seed.attrs, modelHi: seed.modelHi, modelTe: seed.modelTe }),
    price: seed.price,
    mrp: seed.mrp,
    rating: Math.round(avg * 10) / 10,
    ratingCount: seed.ratingCount,
    histogram: histogramOf(reviews),
    stock: seed.stock,
    deliveryDays: seed.deliveryDays,
    seller: seed.seller,
    returnDays: seed.returnDays,
    bestSeller: !!seed.bestSeller,
    choice: !!seed.choice,
    touchFriendly: !!seed.touch,
    hero: !!seed.hero,
    keywords: [seed.brand.toLowerCase(), seed.model.toLowerCase(), category, ...(seed.keywords ?? [])],
    attrs: seed.attrs,
    specs: specsFor(category, seed.attrs),
    look: lookFor(category, seed.attrs),
    photo: files.photo,
    gallery: files.gallery,
    reviews,
    access: seed.access ?? [],
  };
}

export const BLIND: L3 = { en: "A blind shopper", hi: "एक दृष्टिहीन खरीदार", te: "ఒక అంధ కొనుగోలుదారు" };
export const MOTOR: L3 = { en: "A shopper with limited hand movement", hi: "हाथों की सीमित गति वाले खरीदार", te: "చేతుల కదలిక పరిమితంగా ఉన్న కొనుగోలుదారు" };
export const OLDER: L3 = { en: "An older shopper", hi: "एक बुज़ुर्ग खरीदार", te: "ఒక వృద్ధ కొనుగోలుదారు" };
