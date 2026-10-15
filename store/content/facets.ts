import type { L3, Lang } from "@/contract/lang";
import type { Category, FacetDef, FacetKind, FacetOptionDef, Filters, PriceRange } from "@/contract";
import type { Product } from "@/store/catalogue-types";
import { brandIn } from "@/store/content/brands";
import { COLOUR } from "@/store/content/dictionary";

export type { Filters, PriceRange, FacetKind };

/**
 * Every filter, for every category, in one place.
 * The sidebar on the store, the questions Omnikart asks aloud, and the tests all read this file,
 * so what the shopper hears and what they see can never drift apart.
 */

/** A filter option as the store holds it: the contract's description plus the test that decides which products it keeps. */
export interface FacetOption extends FacetOptionDef {
  test: (p: Product) => boolean;
}

export interface Facet extends Omit<FacetDef, "options" | "domId"> {
  options: FacetOption[];
}

export const emptyFilters = (): Filters => ({ sel: {} });

/** Nicknames people say for a brand. */
const BRAND_ALIASES: Record<string, string[]> = {
  "U.S. Polo Assn.": ["us polo", "u s polo", "polo", "uspa"],
  "Jack & Jones": ["jack and jones", "jack jones"],
  "Pepe Jeans": ["pepe"],
  "Flying Machine": ["flying machine"],
  "Red Tape": ["redtape", "red tape"],
  boAt: ["boat", "bot"],
  Samsung: ["samsung", "sam sung", "सैमसंग", "सेमसंग", "सैम्संग", "శాంసంగ్", "సామ్సంగ్", "శామ్సంగ్", "సాంసంగ్", "సామ్ సంగ్"],
  "Levi's": ["levis", "levi", "levi strauss"],
  iQOO: ["iqoo", "iku", "i q o o"],
  realme: ["realme", "real me"],
  OnePlus: ["oneplus", "one plus"],
};

const t = (en: string, hi: string, te: string): L3 => ({ en, hi, te });
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

const BANDS: Record<Category, [number, number]> = {
  phones: [10000, 20000],
  jeans: [1000, 2000],
  cookers: [1000, 2000],
  earbuds: [1500, 4000],
  shoes: [1500, 3500],
};

function budgetFacet(category: Category): Facet {
  const [a, b] = BANDS[category];
  const inRange = (min: number | undefined, max: number | undefined) => (p: Product) => (min === undefined || p.price >= min) && (max === undefined || p.price <= max);
  return {
    id: "budget",
    title: t("budget", "बजट", "బడ్జెట్"),
    ask: t("What is your budget?", "आपका बजट क्या है?", "మీ బడ్జెట్ ఎంత?"),
    kind: "band",
    options: [
      { id: "under", label: t(`under ${money(a)}`, `${money(a)} से कम`, `${money(a)} లోపు`), test: inRange(undefined, a - 1), words: ["cheap", "cheapest", "low", "सस्ता", "చవక"], price: { max: a - 1 } },
      { id: "mid", label: t(`${money(a)} to ${money(b)}`, `${money(a)} से ${money(b)} तक`, `${money(a)} నుండి ${money(b)} వరకు`), test: inRange(a, b), words: ["middle", "medium", "mid", "बीच", "మధ్య"], price: { min: a, max: b } },
      { id: "above", label: t(`above ${money(b)}`, `${money(b)} से ज़्यादा`, `${money(b)} కంటే ఎక్కువ`), test: inRange(b + 1, undefined), words: ["premium", "costly", "expensive", "महंगा", "ఖరీదైన"], price: { min: b + 1 } },
    ],
  };
}

function brandFacet(products: Product[], ask: boolean): Facet {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  const brands = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([b]) => b);
  const id = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return {
    id: "brand",
    title: t("brand", "ब्रांड", "బ్రాండ్"),
    ask: ask ? t("Which brand do you prefer?", "आप कौन सा ब्रांड पसंद करेंगे?", "మీకు ఏ బ్రాండ్ ఇష్టం?") : undefined,
    kind: "single",
    askOptions: brands.slice(0, 4).map(id),
    options: brands.map((b) => ({
      id: id(b),
      label: { en: b, hi: brandIn(b, "hi"), te: brandIn(b, "te") },
      test: (p) => p.brand === b,
      words: [b.toLowerCase().replace(/[^a-z0-9 ]+/g, ""), brandIn(b, "hi").toLowerCase(), brandIn(b, "te").toLowerCase(), ...(BRAND_ALIASES[b] ?? [])],
    })),
  };
}

function colourFacet(products: Product[]): Facet {
  const keys = [...new Set(products.map((p) => String(p.attrs.colour)))].sort();
  return {
    id: "colour",
    title: t("colour", "रंग", "రంగు"),
    kind: "single",
    options: keys.map((k) => ({
      id: k,
      label: COLOUR[k] ?? t(k, k, k),
      test: (p) => p.attrs.colour === k,
      words: [(COLOUR[k]?.en ?? k).toLowerCase(), (COLOUR[k]?.hi ?? "").toLowerCase(), (COLOUR[k]?.te ?? "").toLowerCase()].filter(Boolean),
    })),
  };
}

/** A yes or no question. Yes picks the one option; no means "does not matter". */
function boolFacet(id: string, title: L3, ask: L3 | undefined, label: L3, test: (p: Product) => boolean, words: string[] = []): Facet {
  return { id, title, ask, kind: "bool", options: [{ id: "yes", label, test, words }] };
}

const GENDER_OPTIONS: FacetOption[] = [
  { id: "men", label: t("men", "पुरुषों के लिए", "పురుషుల కోసం"), test: (p) => p.attrs.gender === "men", words: ["men", "man", "male", "gents", "boys", "boy", "पुरुष", "पुरुषों", "आदमी", "मर्द", "लड़कों", "పురుషుల", "పురుషులు", "మగ"] },
  { id: "women", label: t("women", "महिलाओं के लिए", "మహిళల కోసం"), test: (p) => p.attrs.gender === "women", words: ["women", "woman", "female", "ladies", "lady", "girls", "girl", "महिला", "महिलाओं", "औरत", "लड़की", "మహిళ", "మహిళల", "ఆడ"] },
];

/* ------------------------------------------------------------------ *
 * The filters of each category
 * ------------------------------------------------------------------ */

function buildRaw(category: Category, products: Product[]): Facet[] {
  const mine = products.filter((p) => p.category === category);
  const attrNum = (p: Product, k: string) => (typeof p.attrs[k] === "number" ? (p.attrs[k] as number) : 0);
  switch (category) {
    case "phones":
      return [
        budgetFacet(category),
        brandFacet(mine, true),
        boolFacet("battery", t("big battery", "बड़ी बैटरी", "పెద్ద బ్యాటరీ"), t("Do you want a big battery, 5500 mAh or more?", "क्या आप बड़ी बैटरी चाहते हैं, 5500 एमएएच या ज़्यादा?", "మీకు పెద్ద బ్యాటరీ కావాలా, 5500 ఎంఏహెచ్ లేదా ఎక్కువ?"), t("big battery, 5500 mAh or more", "बड़ी बैटरी, 5500 एमएएच या ज़्यादा", "పెద్ద బ్యాటరీ, 5500 ఎంఏహెచ్ లేదా ఎక్కువ"), (p) => attrNum(p, "battery") >= 5500, ["battery", "बैटरी", "బ్యాటరీ", "big"]),
        {
          id: "storage",
          title: t("storage", "स्टोरेज", "స్టోరేజ్"),
          ask: t("How much storage do you need?", "आपको कितना स्टोरेज चाहिए?", "మీకు ఎంత స్టోరేజ్ కావాలి?"),
          kind: "single",
          options: [
            { id: "s128", label: t("128 GB or more", "128 जीबी या ज़्यादा", "128 జీబీ లేదా ఎక్కువ"), test: (p) => attrNum(p, "storage") >= 128, words: [], numbers: [128] },
            { id: "s256", label: t("256 GB or more", "256 जीबी या ज़्यादा", "256 జీబీ లేదా ఎక్కువ"), test: (p) => attrNum(p, "storage") >= 256, words: [], numbers: [256, 512] },
          ],
        },
        {
          id: "ram",
          title: t("memory (RAM)", "मेमोरी (रैम)", "మెమరీ (ర్యామ్)"),
          kind: "single",
          options: [
            { id: "r6", label: t("6 GB or more", "6 जीबी या ज़्यादा", "6 జీబీ లేదా ఎక్కువ"), test: (p) => attrNum(p, "ram") >= 6, words: [], numbers: [6] },
            { id: "r8", label: t("8 GB or more", "8 जीबी या ज़्यादा", "8 జీబీ లేదా ఎక్కువ"), test: (p) => attrNum(p, "ram") >= 8, words: [], numbers: [8] },
          ],
        },
        boolFacet("fiveg", t("5G", "5जी", "5జీ"), undefined, t("5G phones only", "सिर्फ़ 5जी फ़ोन", "5జీ ఫోన్లు మాత్రమే"), (p) => p.attrs.fiveG === true, ["5g"]),
      ];
    case "jeans":
      return [
        budgetFacet(category),
        { id: "gender", title: t("who it is for", "किसके लिए", "ఎవరి కోసం"), ask: t("Is it for men or women?", "यह पुरुषों के लिए है या महिलाओं के लिए?", "ఇది పురుషుల కోసమా, మహిళల కోసమా?"), kind: "single", options: GENDER_OPTIONS },
        {
          id: "fit",
          title: t("fit", "फिटिंग", "ఫిట్"),
          ask: t("Which fit do you like?", "आपको कौन सी फिटिंग पसंद है?", "మీకు ఏ ఫిట్ ఇష్టం?"),
          kind: "single",
          options: [
            { id: "slim", label: t("slim, close to the leg", "स्लिम, पैर के पास", "స్లిమ్, కాలికి దగ్గరగా"), test: (p) => p.attrs.fit === "slim", words: ["slim", "skinny", "tight", "स्लिम", "स्किनी", "స్లిమ్"] },
            { id: "regular", label: t("regular, comfortable", "रेगुलर, आरामदायक", "రెగ్యులర్, సౌకర్యంగా"), test: (p) => p.attrs.fit === "regular", words: ["regular", "straight", "normal", "रेगुलर", "सामान्य", "రెగ్యులర్"] },
            { id: "relaxed", label: t("relaxed, loose", "रिलैक्स्ड, ढीली", "రిలాక్స్డ్, వదులుగా"), test: (p) => p.attrs.fit === "relaxed", words: ["relaxed", "loose", "baggy", "रिलैक्स्ड", "ढीली", "ढीला", "రిలాక్స్డ్", "వదులు"] },
          ],
        },
        {
          id: "waist",
          title: t("waist size", "कमर का साइज़", "నడుము సైజ్"),
          ask: t("What waist size, in inches?", "कमर का साइज़ कितने इंच है?", "నడుము సైజ్ ఎన్ని అంగుళాలు?"),
          kind: "size",
          options: [26, 28, 30, 32, 34, 36, 38].map((n) => ({ id: `w${n}`, label: t(`${n} inches`, `${n} इंच`, `${n} అంగుళాలు`), test: (p) => Array.isArray(p.attrs.sizes) && p.attrs.sizes.includes(n), words: [], numbers: [n] })),
        },
        brandFacet(mine, false),
        colourFacet(mine),
        boolFacet("stretch", t("stretch", "खिंचाव", "సాగుదల"), undefined, t("stretch fabric", "खिंचने वाला कपड़ा", "సాగే బట్ట"), (p) => p.attrs.stretch === true, ["stretch", "stretchable"]),
      ];
    case "cookers":
      return [
        budgetFacet(category),
        {
          id: "capacity",
          title: t("capacity", "क्षमता", "సామర్థ్యం"),
          ask: t("What capacity do you need?", "आपको कितनी क्षमता चाहिए?", "మీకు ఎంత సామర్థ్యం కావాలి?"),
          kind: "single",
          options: [
            { id: "c3", label: t("up to 3 litres", "3 लीटर तक", "3 లీటర్ల వరకు"), test: (p) => attrNum(p, "capacity") <= 3, words: ["small", "छोटा", "చిన్న"], numbers: [1, 2, 3] },
            { id: "c5", label: t("5 litres", "5 लीटर", "5 లీటర్లు"), test: (p) => attrNum(p, "capacity") > 3 && attrNum(p, "capacity") <= 6, words: ["medium", "मध्यम", "మధ్యస్థ"], numbers: [4, 5, 6] },
            { id: "c7", label: t("7 litres or more", "7 लीटर या ज़्यादा", "7 లీటర్లు లేదా ఎక్కువ"), test: (p) => attrNum(p, "capacity") >= 7, words: ["big", "large", "बड़ा", "పెద్ద"], numbers: [7, 8, 9, 10] },
          ],
        },
        {
          id: "material",
          title: t("material", "सामग्री", "పదార్థం"),
          ask: t("Which material do you prefer?", "आपको कौन सी सामग्री पसंद है?", "మీకు ఏ పదార్థం ఇష్టం?"),
          kind: "single",
          options: [
            { id: "steel", label: t("stainless steel", "स्टेनलेस स्टील", "స్టెయిన్‌లెస్ స్టీల్"), test: (p) => p.attrs.material === "steel", words: ["steel", "stainless", "स्टील", "स्टेनलेस", "స్టీల్", "స్టెయిన్‌లెస్"] },
            { id: "aluminium", label: t("aluminium", "एल्यूमिनियम", "అల్యూమినియం"), test: (p) => p.attrs.material === "aluminium", words: ["aluminium", "aluminum", "एल्यूमिनियम", "अल्युमिनियम", "అల్యూమినియం"] },
            { id: "anodised", label: t("hard anodised", "हार्ड एनोडाइज़्ड", "హార్డ్ ఆనోడైజ్డ్"), test: (p) => p.attrs.material === "anodised", words: ["anodised", "anodized", "hard", "एनोडाइज़्ड", "ఆనోడైజ్డ్"] },
          ],
        },
        boolFacet("induction", t("induction", "इंडक्शन", "ఇండక్షన్"), t("Do you cook on an induction stove?", "क्या आप इंडक्शन चूल्हे पर खाना बनाते हैं?", "మీరు ఇండక్షన్ స్టవ్‌పై వండుతారా?"), t("works on induction", "इंडक्शन पर चलता है", "ఇండక్షన్‌పై పనిచేస్తుంది"), (p) => p.attrs.induction === true, ["induction", "इंडक्शन", "ఇండక్షన్"]),
        brandFacet(mine, false),
        {
          id: "lid",
          title: t("lid type", "ढक्कन का प्रकार", "మూత రకం"),
          kind: "single",
          options: [
            { id: "inner", label: t("inner lid", "अंदर वाला ढक्कन", "లోపలి మూత"), test: (p) => p.attrs.lid === "inner", words: ["inner"] },
            { id: "outer", label: t("outer lid", "बाहर वाला ढक्कन", "బయటి మూత"), test: (p) => p.attrs.lid === "outer", words: ["outer"] },
          ],
        },
      ];
    case "earbuds":
      return [
        budgetFacet(category),
        brandFacet(mine, true),
        boolFacet("battery", t("long battery", "लंबी बैटरी", "ఎక్కువ బ్యాటరీ"), t("Do you want a long battery, 40 hours or more with the case?", "क्या आप लंबी बैटरी चाहते हैं, केस के साथ 40 घंटे या ज़्यादा?", "మీకు ఎక్కువ బ్యాటరీ కావాలా, కేస్‌తో 40 గంటలు లేదా ఎక్కువ?"), t("40 hours or more with the case", "केस के साथ 40 घंटे या ज़्यादा", "కేస్‌తో 40 గంటలు లేదా ఎక్కువ"), (p) => attrNum(p, "hours") >= 40, ["battery", "बैटरी", "బ్యాటరీ", "long"]),
        boolFacet("anc", t("noise cancelling", "शोर रद्द करना", "శబ్దం రద్దు"), t("Do you want noise cancelling?", "क्या आपको शोर रद्द करने वाला चाहिए?", "మీకు శబ్దం రద్దు కావాలా?"), t("with noise cancelling", "शोर रद्द करने वाला", "శబ్దం రద్దుతో"), (p) => p.attrs.anc === true, ["noise", "cancelling", "anc", "शोर", "శబ్దం"]),
        boolFacet("water", t("water resistance", "पानी से सुरक्षा", "నీటి నిరోధకత"), undefined, t("water resistant, IPX4 or better", "पानी से सुरक्षित, आईपीएक्स4 या बेहतर", "నీటి నిరోధకత, ఐపీఎక్స్4 లేదా మెరుగైనది"), (p) => attrNum(p, "ipx") >= 4, ["water", "waterproof", "sweat"]),
        colourFacet(mine),
      ];
    case "shoes":
      return [
        budgetFacet(category),
        { id: "gender", title: t("who it is for", "किसके लिए", "ఎవరి కోసం"), ask: t("Are the shoes for men or women?", "जूते पुरुषों के लिए हैं या महिलाओं के लिए?", "బూట్లు పురుషుల కోసమా, మహిళల కోసమా?"), kind: "single", options: GENDER_OPTIONS },
        {
          id: "type",
          title: t("type", "प्रकार", "రకం"),
          ask: t("What kind of shoes: sports, casual or formal?", "किस तरह के जूते: स्पोर्ट्स, कैज़ुअल या फ़ॉर्मल?", "ఎలాంటి బూట్లు: స్పోర్ట్స్, క్యాజువల్ లేదా ఫార్మల్?"),
          kind: "single",
          options: [
            { id: "sports", label: t("sports", "स्पोर्ट्स", "స్పోర్ట్స్"), test: (p) => p.attrs.type === "sports", words: ["sports", "sport", "running", "gym", "स्पोर्ट्स", "स्पोर्ट", "స్పోర్ట్స్"] },
            { id: "casual", label: t("casual", "कैज़ुअल", "క్యాజువల్"), test: (p) => p.attrs.type === "casual", words: ["casual", "daily", "कैज़ुअल", "कैजुअल", "క్యాజువల్"] },
            { id: "formal", label: t("formal", "फ़ॉर्मल", "ఫార్మల్"), test: (p) => p.attrs.type === "formal", words: ["formal", "office", "फ़ॉर्मल", "फॉर्मल", "ఫార్మల్"] },
          ],
        },
        {
          id: "size",
          title: t("UK size", "यूके साइज़", "యూకే సైజ్"),
          ask: t("What UK shoe size?", "यूके साइज़ कौन सा है?", "యూకే షూ సైజ్ ఎంత?"),
          kind: "size",
          options: [3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({ id: `u${n}`, label: t(`size ${n}`, `साइज़ ${n}`, `సైజ్ ${n}`), test: (p) => Array.isArray(p.attrs.sizes) && p.attrs.sizes.includes(n), words: [], numbers: [n] })),
        },
        brandFacet(mine, false),
        colourFacet(mine),
        {
          id: "closure",
          title: t("closure", "बंद करने का तरीका", "మూసివేత"),
          kind: "single",
          options: [
            { id: "laces", label: t("laces", "फीते वाले", "లేసులతో"), test: (p) => p.attrs.closure === "laces", words: ["laces", "lace", "फीते", "లేసులు"] },
            { id: "slipOn", label: t("slip on, no laces", "बिना फीते", "లేసులు లేకుండా"), test: (p) => p.attrs.closure === "slipOn", words: ["slip", "slipon", "no laces", "बिना फीते", "లేసులు లేకుండా"] },
          ],
        },
      ];
    default:
      return [budgetFacet(category)];
  }
}

export function facetById(facets: Facet[], id: string | null | undefined): Facet | undefined {
  return id ? facets.find((f) => f.id === id) : undefined;
}

/** Facets Omnikart asks aloud, in the order it asks them. */
export function askedFacets(facets: Facet[]): Facet[] {
  return facets.filter((f) => !!f.ask);
}

/* ------------------------------------------------------------------ *
 * Applying filters
 * ------------------------------------------------------------------ */

export function matchesFilters(p: Product, f: Filters, facets: Facet[], except?: string): boolean {
  if (f.price?.min !== undefined && p.price < f.price.min) return false;
  if (f.price?.max !== undefined && p.price > f.price.max) return false;
  if (f.rating !== undefined && p.rating < f.rating) return false;
  for (const [facetId, ids] of Object.entries(f.sel)) {
    if (facetId === except || ids.length === 0) continue;
    const facet = facetById(facets, facetId);
    if (!facet) continue;
    const opts = facet.options.filter((o) => ids.includes(o.id));
    if (opts.length > 0 && !opts.some((o) => o.test(p))) return false;
  }
  return true;
}

/** The price band option that matches the current price filter exactly, if any (for the sidebar). */
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

export function buildFacets(category: Category, products: Product[]): Facet[] {
  return buildRaw(category, products);
}

/** What the contract's meta() shows for a facet: the same thing without the functions. */
export function toFacetDef(f: Facet): FacetDef {
  return {
    id: f.id,
    title: f.title,
    ask: f.ask,
    kind: f.kind,
    askOptions: f.askOptions,
    domId: `facet-${f.id}`,
    options: f.options.map((o) => ({ id: o.id, label: o.label, words: o.words, numbers: o.numbers, price: o.price })),
  };
}
