import type { L3, Lang } from "@/contract/lang";
import type { Product, Spec } from "@/store/catalogue-types";
import { DERIVED } from "@/store/catalogue";
import { ASPECT_SUMMARY, SPEC_LABEL, unitText, type AspectKey } from "@/store/content/dictionary";

/**
 * Turns raw catalogue data into the short, plain versions Omnikart speaks.
 * All of this is plain code over catalogue data, so it can only say what the source says.
 * scripts/precompute.ts may write LLM summaries to data/derived.json; those win when present.
 */

export function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function specValueText(spec: Spec, lang: Lang): string {
  if (typeof spec.value === "number") {
    const u = unitText(spec.unit, spec.value, lang);
    return u ? `${fmtNumber(spec.value)} ${u}` : fmtNumber(spec.value);
  }
  return spec.value[lang];
}

export function specLabel(spec: Spec, lang: Lang): string {
  return SPEC_LABEL[spec.key]?.[lang] ?? spec.key;
}

/** "Top 5 things to know": the first five specs as short "label: value" lines. */
export function topFacts(p: Product, lang: Lang, count = 5): string[] {
  return p.specs.slice(0, count).map((s) => `${specLabel(s, lang)}: ${specValueText(s, lang)}`);
}

/* ---------------- reviews ---------------- */

export type Verdict = "happy" | "mostly" | "mixed";

export interface ReviewSummary {
  reviewCount: number;
  average: number;
  pros: string[];
  cons: string[];
  verdict: Verdict;
  source: "reviews" | "llm";
}

export function verdictFor(average: number): Verdict {
  if (average >= 4.2) return "happy";
  if (average >= 3.6) return "mostly";
  return "mixed";
}

interface Tally {
  pos: number;
  neg: number;
}

export function tallyAspects(p: Product): Map<AspectKey, Tally> {
  const m = new Map<AspectKey, Tally>();
  for (const r of p.reviews) {
    for (const a of r.aspects) {
      const t = m.get(a.aspect) ?? { pos: 0, neg: 0 };
      if (a.pol > 0) t.pos++;
      else t.neg++;
      m.set(a.aspect, t);
    }
  }
  return m;
}

/**
 * Pros, cons and a verdict.
 * A pro is something most mentions praised; a con is something at least two buyers
 * (one buyer when there are fewer than ten reviews) complained about.
 */
export function reviewSummary(p: Product, lang: Lang): ReviewSummary {
  const override = DERIVED[p.id]?.reviewSummary;
  const average = p.rating;
  if (override) {
    return {
      reviewCount: override.reviewCount,
      average,
      pros: override.pros.map((x) => x[lang]),
      cons: override.cons.map((x) => x[lang]),
      verdict: verdictFor(average),
      source: "llm",
    };
  }
  const tally = tallyAspects(p);
  const minNeg = p.reviews.length < 10 ? 1 : 2;
  const entries = [...tally.entries()];
  const pros = entries
    .filter(([, t]) => t.pos > t.neg)
    .sort((a, b) => b[1].pos - b[1].neg - (a[1].pos - a[1].neg))
    .slice(0, 3)
    .map(([k]) => ASPECT_SUMMARY[k].pos[lang]);
  const cons = entries
    .filter(([, t]) => t.neg >= minNeg)
    .sort((a, b) => b[1].neg - a[1].neg)
    .slice(0, 2)
    .map(([k]) => ASPECT_SUMMARY[k].neg[lang]);
  return { reviewCount: p.reviews.length, average, pros, cons, verdict: verdictFor(average), source: "reviews" };
}

/* ---------------- explain simpler ---------------- */

const E = (en: string, hi: string, te: string): L3 => ({ en, hi, te });

/** Spec to everyday meaning. Same facts, no jargon. Returns null when we have no honest simple version. */
export function explainSpec(p: Product, s: Spec): L3 | null {
  const n = typeof s.value === "number" ? s.value : null;
  const yes = typeof s.value !== "number" && s.value.en === "Yes";
  switch (`${p.category}:${s.key}`) {
    case "phones:battery":
      if (n === null) return null;
      if (n >= 5500) return E("easily lasts a full day, often two", "पूरा दिन आराम से चलती है, अक्सर दो दिन", "పూర్తి రోజు సులభంగా వస్తుంది, తరచుగా రెండు రోజులు");
      if (n >= 4500) return E("lasts about a day on one charge", "एक चार्ज में लगभग एक दिन चलती है", "ఒక ఛార్జ్‌కు సుమారు ఒక రోజు వస్తుంది");
      return E("needs charging before the day is over", "दिन ख़त्म होने से पहले चार्ज करनी पड़ेगी", "రోజు ముగిసేలోపు ఛార్జ్ చేయాలి");
    case "phones:ram":
      if (n === null) return null;
      if (n >= 8) return E("runs many apps at once without slowing down", "कई ऐप एक साथ बिना धीमे हुए चलाता है", "చాలా యాప్‌లను ఒకేసారి నెమ్మదించకుండా నడుపుతుంది");
      if (n >= 6) return E("runs many apps smoothly", "कई ऐप आराम से चलाता है", "చాలా యాప్‌లను సాఫీగా నడుపుతుంది");
      return E("fine for everyday apps", "रोज़ के ऐप के लिए ठीक है", "రోజువారీ యాప్‌లకు సరిపోతుంది");
    case "phones:storage":
      if (n === null) return null;
      if (n >= 256) return E("space for tens of thousands of photos and many apps", "हज़ारों फ़ोटो, वीडियो और कई ऐप के लिए जगह", "వేల ఫోటోలు, వీడియోలు, చాలా యాప్‌లకు చోటు");
      if (n >= 128) return E("space for thousands of photos and many apps", "हज़ारों फ़ोटो और कई ऐप के लिए जगह", "వేల ఫోటోలు, చాలా యాప్‌లకు చోటు");
      return E("space for a few thousand photos and a few apps", "कुछ हज़ार फ़ोटो और कुछ ऐप के लिए जगह", "కొన్ని వేల ఫోటోలు, కొన్ని యాప్‌లకు చోటు");
    case "phones:screen":
      if (n === null) return null;
      return n >= 6.5
        ? E("a big screen that is easy to read", "बड़ी स्क्रीन, पढ़ने में आसान", "పెద్ద స్క్రీన్, చదవడానికి సులభం")
        : E("a medium sized screen", "मध्यम आकार की स्क्रीन", "మధ్యస్థ పరిమాణం స్క్రీన్");
    case "phones:camera":
      if (n === null) return null;
      return n >= 100
        ? E("very detailed photos in good light", "अच्छी रोशनी में बहुत बारीक फ़ोटो", "మంచి వెలుతురులో చాలా వివరమైన ఫోటోలు")
        : E("sharp photos in daylight", "दिन की रोशनी में साफ़ फ़ोटो", "పగటి వెలుతురులో స్పష్టమైన ఫోటోలు");
    case "phones:network":
      return typeof s.value !== "number" && s.value.en === "5G"
        ? E("works on the fast 5G network", "तेज़ 5जी नेटवर्क पर चलता है", "వేగవంతమైన 5జీ నెట్‌వర్క్‌పై పనిచేస్తుంది")
        : E("works on 4G only, not 5G", "सिर्फ़ 4जी पर चलता है, 5जी पर नहीं", "4జీపై మాత్రమే పనిచేస్తుంది, 5జీపై కాదు");
    case "jeans:fit":
      if (typeof s.value === "number") return null;
      if (s.value.en === "Slim") return E("close to the leg, but not tight", "पैर के पास, पर तंग नहीं", "కాలికి దగ్గరగా, కానీ బిగుతుగా కాదు");
      if (s.value.en === "Relaxed") return E("loose and roomy, easy to move in", "ढीली और खुली, चलने में आसान", "వదులుగా, విశాలంగా, కదలడానికి సులభం");
      return E("a normal comfortable fit", "सामान्य आरामदायक फिटिंग", "సాధారణ సౌకర్యవంతమైన ఫిట్");
    case "jeans:stretch":
      return typeof s.value !== "number" && s.value.en.startsWith("Stretches")
        ? E("gives a little, so it is easy to sit and bend in", "थोड़ा खिंचती है, इसलिए बैठना और झुकना आसान है", "కొద్దిగా సాగుతుంది, కాబట్టి కూర్చోవడం, వంగడం సులభం")
        : E("does not stretch, so pick your size carefully", "खिंचती नहीं, इसलिए साइज़ सोच समझकर चुनें", "సాగదు, కాబట్టి సైజ్ జాగ్రత్తగా ఎంచుకోండి");
    case "jeans:care":
    case "shoes:care":
      return E("you can wash it in a washing machine", "वाशिंग मशीन में धो सकते हैं", "వాషింగ్ మెషీన్‌లో ఉతకవచ్చు");
    case "cookers:capacity":
      if (n === null) return null;
      if (n <= 2) return E("cooks for one or two people", "एक या दो लोगों का खाना बनता है", "ఒకరిద్దరికి వండవచ్చు");
      if (n <= 3) return E("cooks for two to four people", "दो से चार लोगों का खाना बनता है", "ఇద్దరి నుండి నలుగురికి వండవచ్చు");
      if (n <= 5) return E("cooks for four to six people", "चार से छह लोगों का खाना बनता है", "నలుగురి నుండి ఆరుగురికి వండవచ్చు");
      return E("cooks for a big family", "बड़े परिवार का खाना बनता है", "పెద్ద కుటుంబానికి వండవచ్చు");
    case "cookers:induction":
      return yes
        ? E("works on both gas and induction", "गैस और इंडक्शन दोनों पर चलता है", "గ్యాస్, ఇండక్షన్ రెండింటిపైనా పనిచేస్తుంది")
        : E("works on gas only", "सिर्फ़ गैस पर चलता है", "గ్యాస్‌పై మాత్రమే పనిచేస్తుంది");
    case "cookers:material":
      if (typeof s.value === "number") return null;
      if (s.value.en === "Stainless Steel") return E("lasts long and does not react with food", "लंबे समय तक चलता है और खाने से प्रतिक्रिया नहीं करता", "ఎక్కువ కాలం మన్నుతుంది, ఆహారంతో చర్య జరపదు");
      if (s.value.en === "Aluminium") return E("light and heats fast, for gas stoves", "हल्का और जल्दी गरम होता है, गैस के लिए", "తేలికగా ఉంటుంది, త్వరగా వేడెక్కుతుంది, గ్యాస్ కోసం");
      return E("hard coating, food does not stick much", "सख़्त परत, खाना कम चिपकता है", "గట్టి పూత, ఆహారం తక్కువగా అంటుకుంటుంది");
    case "cookers:lid":
      if (typeof s.value === "number") return null;
      return s.value.en === "Inner lid"
        ? E("the lid sits inside the pot and seals tighter under pressure", "ढक्कन बर्तन के अंदर बैठता है और दबाव में ज़्यादा कसता है", "మూత గిన్నె లోపల కూర్చుంటుంది, ఒత్తిడిలో గట్టిగా మూసుకుంటుంది")
        : E("the lid sits over the pot and is easy to open and close", "ढक्कन बर्तन के ऊपर बैठता है और खोलना बंद करना आसान है", "మూత గిన్నె పైన కూర్చుంటుంది, తెరవడం మూయడం సులభం");
    case "earbuds:hours":
      if (n === null) return null;
      if (n >= 60) return E("lasts about two weeks at two hours a day", "रोज़ दो घंटे सुनने पर लगभग दो हफ़्ते चलता है", "రోజుకు రెండు గంటలు వింటే సుమారు రెండు వారాలు వస్తుంది");
      if (n >= 36) return E("lasts about a week at four hours a day", "रोज़ चार घंटे सुनने पर लगभग एक हफ़्ता चलता है", "రోజుకు నాలుగు గంటలు వింటే సుమారు ఒక వారం వస్తుంది");
      return E("lasts a few days between charges", "चार्ज के बीच कुछ दिन चलता है", "ఛార్జ్ల మధ్య కొన్ని రోజులు వస్తుంది");
    case "earbuds:anc":
      return yes
        ? E("blocks much of the noise around you, good for travel", "आसपास का काफ़ी शोर रोकता है, सफ़र के लिए अच्छा", "చుట్టూ ఉన్న శబ్దాన్ని చాలావరకు అడ్డుకుంటుంది, ప్రయాణానికి మంచిది")
        : E("does not block outside noise", "बाहर का शोर नहीं रोकता", "బయటి శబ్దాన్ని అడ్డుకోదు");
    case "earbuds:ipx":
      if (typeof s.value === "number") return null;
      return s.value.en === "No"
        ? E("keep it away from water and sweat", "पानी और पसीने से बचाकर रखें", "నీరు, చెమట నుండి దూరంగా ఉంచండి")
        : E("safe against sweat and light rain", "पसीने और हल्की बारिश से सुरक्षित", "చెమట, తేలికపాటి వర్షం నుండి సురక్షితం");
    case "shoes:type":
      if (typeof s.value === "number") return null;
      if (s.value.en === "Sports") return E("made for running, the gym and long walks", "दौड़ने, जिम और लंबी सैर के लिए", "పరుగు, జిమ్, సుదీర్ఘ నడక కోసం");
      if (s.value.en === "Formal") return E("for office and occasions", "दफ़्तर और समारोहों के लिए", "కార్యాలయం, శుభకార్యాల కోసం");
      return E("for everyday wear", "रोज़ पहनने के लिए", "రోజూ ధరించడానికి");
    case "shoes:closure":
      return typeof s.value !== "number" && s.value.en.startsWith("Slip")
        ? E("no laces to tie, you just step in", "फीते बाँधने नहीं पड़ते, सीधे पहन लें", "లేసులు కట్టాల్సిన పనిలేదు, నేరుగా వేసుకోండి")
        : E("laces hold your foot firmly", "फीते पैर को मज़बूती से पकड़ते हैं", "లేసులు పాదాన్ని గట్టిగా పట్టుకుంటాయి");
    case "shoes:material":
      if (typeof s.value === "number") return null;
      if (s.value.en === "Breathable mesh") return E("airy, keeps your feet cool", "हवादार, पैरों को ठंडा रखता है", "గాలి ఆడుతుంది, పాదాలను చల్లగా ఉంచుతుంది");
      if (s.value.en === "Leather") return E("strong and easy to wipe clean", "मज़बूत और पोंछकर साफ़ करना आसान", "బలంగా ఉంటుంది, తుడిచి శుభ్రం చేయడం సులభం");
      return null;
    default:
      if (s.key === "warranty") {
        return E("the seller fixes faults for free during this time", "इस दौरान ख़राबी होने पर विक्रेता मुफ़्त में ठीक करेगा", "ఈ సమయంలో లోపాలను విక్రేత ఉచితంగా సరిచేస్తారు");
      }
      return null;
  }
}

/** Up to `count` "label: simple meaning" lines. */
export function simpleFacts(p: Product, lang: Lang, count = 4): string[] {
  const out: string[] = [];
  for (const s of p.specs) {
    const e = explainSpec(p, s);
    if (e) out.push(`${specLabel(s, lang)}: ${e[lang]}`);
    if (out.length >= count) break;
  }
  return out;
}

/* ---------------- photo ---------------- */

export function photoDescription(p: Product, lang: Lang): { text: string; source: "catalogue" | "llm" } {
  const o = DERIVED[p.id]?.look;
  return o ? { text: o[lang], source: "llm" } : { text: p.look[lang], source: "catalogue" };
}

/** The comparison "main difference": the numeric spec with the biggest relative gap, else the price. */
export function mainDifference(a: Product, b: Product): { key: string; a: Spec; b: Spec } | null {
  let best: { key: string; a: Spec; b: Spec; gap: number } | null = null;
  for (const sa of a.specs) {
    const sb = b.specs.find((x) => x.key === sa.key);
    if (!sb || typeof sa.value !== "number" || typeof sb.value !== "number" || sa.key === "warranty" || sa.key === "weight") continue;
    const hi = Math.max(sa.value, sb.value);
    const lo = Math.min(sa.value, sb.value);
    if (hi === 0) continue;
    const gap = (hi - lo) / hi;
    if (gap > 0 && (!best || gap > best.gap)) best = { key: sa.key, a: sa, b: sb, gap };
  }
  return best ? { key: best.key, a: best.a, b: best.b } : null;
}
