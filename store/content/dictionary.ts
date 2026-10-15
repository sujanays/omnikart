import type { L3, Lang } from "@/contract/lang";
import type { Category } from "@/contract";

/**
 * Words used to describe products in three languages.
 * Hindi and Telugu were drafted by the assistant. A native speaker should read them aloud once.
 */

export const YES: L3 = { en: "Yes", hi: "हाँ", te: "అవును" };
export const NO: L3 = { en: "No", hi: "नहीं", te: "కాదు" };

/** What the category is called when we say "I have 12 of them". Plural. */
export const CATEGORY_NAME: Record<Category, L3> = {
  phones: { en: "phones", hi: "फ़ोन", te: "ఫోన్లు" },
  jeans: { en: "jeans", hi: "जींस", te: "జీన్స్" },
  cookers: { en: "pressure cookers", hi: "प्रेशर कुकर", te: "ప్రెషర్ కుక్కర్లు" },
  earbuds: { en: "Bluetooth earbuds", hi: "ब्लूटूथ ईयरबड्स", te: "బ్లూటూత్ ఇయర్‌బడ్స్" },
  shoes: { en: "shoes", hi: "जूते", te: "బూట్లు" },
};

export type UnitKey =
  | "litre" | "watt" | "gb" | "mah" | "inch" | "mp" | "kg" | "gram" | "mm"
  | "year" | "hour" | "lumen" | "metre" | "count" | "rpm" | "star" | "speed" | "day";

/** en has a singular and a plural; hi and te use one form. */
export const UNITS: Record<UnitKey, { en: [string, string]; hi: string; te: string }> = {
  litre: { en: ["litre", "litres"], hi: "लीटर", te: "లీటర్లు" },
  watt: { en: ["watt", "watts"], hi: "वाट", te: "వాట్లు" },
  gb: { en: ["GB", "GB"], hi: "जीबी", te: "జీబీ" },
  mah: { en: ["mAh", "mAh"], hi: "एमएएच", te: "ఎంఏహెచ్" },
  inch: { en: ["inch", "inches"], hi: "इंच", te: "అంగుళాలు" },
  mp: { en: ["megapixel", "megapixels"], hi: "मेगापिक्सल", te: "మెగాపిక్సెల్" },
  kg: { en: ["kilogram", "kilograms"], hi: "किलो", te: "కిలోలు" },
  gram: { en: ["gram", "grams"], hi: "ग्राम", te: "గ్రాములు" },
  mm: { en: ["millimetre", "millimetres"], hi: "मिलीमीटर", te: "మిల్లీమీటర్లు" },
  year: { en: ["year", "years"], hi: "साल", te: "సంవత్సరాలు" },
  hour: { en: ["hour", "hours"], hi: "घंटे", te: "గంటలు" },
  lumen: { en: ["lumen", "lumens"], hi: "ल्यूमेन", te: "ల్యూమెన్లు" },
  metre: { en: ["metre", "metres"], hi: "मीटर", te: "మీటర్లు" },
  count: { en: ["", ""], hi: "", te: "" },
  rpm: { en: ["turn per minute", "turns per minute"], hi: "चक्कर प्रति मिनट", te: "నిమిషానికి తిరుగుళ్ళు" },
  star: { en: ["star", "stars"], hi: "स्टार", te: "స్టార్" },
  speed: { en: ["speed", "speeds"], hi: "स्पीड", te: "స్పీడ్లు" },
  day: { en: ["day", "days"], hi: "दिन", te: "రోజులు" },
};

export function unitText(unit: UnitKey | undefined, value: number, lang: Lang): string {
  if (!unit) return "";
  const u = UNITS[unit];
  if (lang === "en") return value === 1 ? u.en[0] : u.en[1];
  return u[lang];
}

const t = (en: string, hi: string, te: string): L3 => ({ en, hi, te });

export const SPEC_LABEL: Record<string, L3> = {
  battery: t("Battery", "बैटरी", "బ్యాటరీ"),
  ram: t("Memory (RAM)", "मेमोरी (रैम)", "మెమరీ (ర్యామ్)"),
  storage: t("Storage", "स्टोरेज", "స్టోరేజ్"),
  screen: t("Screen size", "स्क्रीन का आकार", "స్క్రీన్ పరిమాణం"),
  camera: t("Main camera", "मुख्य कैमरा", "ప్రధాన కెమెరా"),
  network: t("Network", "नेटवर्क", "నెట్‌వర్క్"),
  colour: t("Colour", "रंग", "రంగు"),
  gender: t("Made for", "किसके लिए", "ఎవరి కోసం"),
  fit: t("Fit", "फिटिंग", "ఫిట్"),
  fabric: t("Fabric", "कपड़ा", "బట్ట"),
  stretch: t("Stretch", "खिंचाव", "సాగుదల"),
  sizes: t("Sizes in stock", "उपलब्ध साइज़", "అందుబాటులో ఉన్న సైజులు"),
  care: t("Washing", "धुलाई", "ఉతకడం"),
  capacity: t("Capacity", "क्षमता", "సామర్థ్యం"),
  material: t("Material", "सामग्री", "పదార్థం"),
  induction: t("Works on induction", "इंडक्शन पर चलता है", "ఇండక్షన్‌పై పనిచేస్తుంది"),
  lid: t("Lid type", "ढक्कन का प्रकार", "మూత రకం"),
  warranty: t("Warranty", "वारंटी", "వారంటీ"),
  hours: t("Battery life with case", "केस के साथ बैटरी", "కేస్‌తో బ్యాటరీ"),
  anc: t("Noise cancelling", "शोर रद्द करना", "శబ్దం రద్దు"),
  ipx: t("Water resistance", "पानी से सुरक्षा", "నీటి నిరోధకత"),
  driver: t("Speaker size", "स्पीकर का आकार", "స్పీకర్ పరిమాణం"),
  bluetooth: t("Bluetooth version", "ब्लूटूथ संस्करण", "బ్లూటూత్ వెర్షన్"),
  type: t("Type", "प्रकार", "రకం"),
  closure: t("Closure", "बंद करने का तरीका", "మూసివేత"),
  sole: t("Sole", "तलवा", "అడుగు భాగం"),
};

/** Short qualitative values used in specs. */
export const VALUE: Record<string, L3> = {
  fiveG: t("5G", "5जी", "5జీ"),
  fourG: t("4G", "4जी", "4జీ"),
  men: t("Men", "पुरुष", "పురుషులు"),
  women: t("Women", "महिलाएँ", "మహిళలు"),
  slim: t("Slim", "स्लिम", "స్లిమ్"),
  regular: t("Regular", "रेगुलर", "రెగ్యులర్"),
  relaxed: t("Relaxed", "रिलैक्स्ड", "రిలాక్స్డ్"),
  stretchYes: t("Stretches for comfort", "आराम के लिए खिंचता है", "సౌకర్యం కోసం సాగుతుంది"),
  stretchNo: t("No stretch", "खिंचाव नहीं", "సాగదు"),
  cottonStretch: t("Cotton with a little elastane", "सूती, थोड़ा इलास्टेन", "కాటన్, కొద్దిగా ఎలాస్టేన్"),
  cotton: t("Cotton", "सूती", "కాటన్"),
  machineWash: t("Machine wash", "मशीन में धुल सकता है", "మెషీన్‌లో ఉతకవచ్చు"),
  steel: t("Stainless Steel", "स्टेनलेस स्टील", "స్టెయిన్‌లెస్ స్టీల్"),
  aluminium: t("Aluminium", "एल्यूमिनियम", "అల్యూమినియం"),
  anodised: t("Hard Anodised", "हार्ड एनोडाइज़्ड", "హార్డ్ ఆనోడైజ్డ్"),
  innerLid: t("Inner lid", "अंदर वाला ढक्कन", "లోపలి మూత"),
  outerLid: t("Outer lid", "बाहर वाला ढक्कन", "బయటి మూత"),
  sports: t("Sports", "स्पोर्ट्स", "స్పోర్ట్స్"),
  casual: t("Casual", "कैज़ुअल", "క్యాజువల్"),
  formal: t("Formal", "फ़ॉर्मल", "ఫార్మల్"),
  laces: t("Laces", "फीते", "లేసులు"),
  slipOn: t("Slip on, no laces", "बिना फीते, सीधे पहनें", "లేసులు లేవు, నేరుగా వేసుకోవచ్చు"),
  mesh: t("Breathable mesh", "हवादार जाली", "గాలి ఆడే మెష్"),
  leather: t("Leather", "चमड़ा", "తోలు"),
  synthetic: t("Synthetic", "सिंथेटिक", "సింథటిక్"),
  rubber: t("Rubber", "रबर", "రబ్బరు"),
  eva: t("Cushioned foam", "गद्देदार फ़ोम", "మెత్తని ఫోమ్"),
};

/** Colour names, for titles and filters. */
export const COLOUR: Record<string, L3> = {
  blue: t("Blue", "नीला", "నీలం"),
  darkBlue: t("Dark blue", "गहरा नीला", "ముదురు నీలం"),
  black: t("Black", "काला", "నలుపు"),
  grey: t("Grey", "स्लेटी", "బూడిద"),
  white: t("White", "सफ़ेद", "తెలుపు"),
  red: t("Red", "लाल", "ఎరుపు"),
  green: t("Green", "हरा", "ఆకుపచ్చ"),
  silver: t("Silver", "चाँदी जैसा", "వెండి రంగు"),
  brown: t("Brown", "भूरा", "గోధుమ"),
  navy: t("Navy", "नेवी", "నేవీ"),
  purple: t("Purple", "बैंगनी", "ఊదా"),
  gold: t("Gold", "सुनहरा", "బంగారు"),
  orange: t("Orange", "नारंगी", "నారింజ"),
};

export const COLOUR_HEX: Record<string, string> = {
  blue: "#3b6ea5",
  darkBlue: "#23395d",
  black: "#1c1c1c",
  grey: "#8b8f94",
  white: "#f2f2f2",
  red: "#b3262d",
  green: "#3c7a4d",
  silver: "#c7ccd1",
  brown: "#7a5230",
  navy: "#1f2a52",
  purple: "#6b4a9a",
  gold: "#c9a24a",
  orange: "#d9791f",
};

export type AspectKey =
  | "build" | "handle" | "value" | "size" | "safety" | "cleaning" | "battery" | "camera"
  | "screen" | "speed" | "sound" | "fit" | "fabric" | "colour" | "wash" | "noise"
  | "brightness" | "delivery" | "packing" | "airflow"
  | "anc" | "comfort" | "connect" | "calls" | "grip" | "looks";

/** What buyers liked (pos) and did not like (neg), in three languages. */
export const ASPECT_SUMMARY: Record<AspectKey, { pos: L3; neg: L3 }> = {
  build: {
    pos: { en: "sturdy build", hi: "मज़बूत बनावट", te: "దృఢమైన తయారీ" },
    neg: { en: "build feels weak", hi: "बनावट कमज़ोर लगती है", te: "తయారీ బలహీనంగా అనిపిస్తుంది" },
  },
  handle: {
    pos: { en: "handle stays cool and is easy to grip", hi: "हैंडल ठंडा रहता है और पकड़ना आसान है", te: "హ్యాండిల్ వేడెక్కదు, పట్టుకోవడం సులభం" },
    neg: { en: "handle gets hot or feels loose", hi: "हैंडल गरम या ढीला हो जाता है", te: "హ్యాండిల్ వేడెక్కుతుంది లేదా వదులుగా ఉంటుంది" },
  },
  value: {
    pos: { en: "good value for money", hi: "पैसे वसूल है", te: "డబ్బుకు తగిన విలువ" },
    neg: { en: "a bit costly for what it gives", hi: "कीमत के हिसाब से थोड़ा महँगा", te: "ఇచ్చే దానికి కొంచెం ఖరీదు" },
  },
  size: {
    pos: { en: "the size is just right", hi: "साइज़ बिल्कुल सही है", te: "పరిమాణం సరిగ్గా ఉంది" },
    neg: { en: "smaller than expected", hi: "उम्मीद से छोटा है", te: "అనుకున్నదానికంటే చిన్నది" },
  },
  safety: {
    pos: { en: "lid closes tight and feels safe", hi: "ढक्कन कसकर बंद होता है, सुरक्षित लगता है", te: "మూత గట్టిగా మూసుకుంటుంది, సురక్షితంగా ఉంది" },
    neg: { en: "lid is hard to close", hi: "ढक्कन बंद करना मुश्किल है", te: "మూత మూయడం కష్టం" },
  },
  cleaning: {
    pos: { en: "easy to clean", hi: "साफ़ करना आसान है", te: "శుభ్రం చేయడం సులభం" },
    neg: { en: "hard to clean", hi: "साफ़ करना मुश्किल है", te: "శుభ్రం చేయడం కష్టం" },
  },
  battery: {
    pos: { en: "battery lasts long", hi: "बैटरी लंबी चलती है", te: "బ్యాటరీ ఎక్కువసేపు వస్తుంది" },
    neg: { en: "battery drains fast", hi: "बैटरी जल्दी खत्म होती है", te: "బ్యాటరీ త్వరగా అయిపోతుంది" },
  },
  camera: {
    pos: { en: "photos look sharp", hi: "फ़ोटो साफ़ आती हैं", te: "ఫోటోలు స్పష్టంగా వస్తాయి" },
    neg: { en: "photos are dull in low light", hi: "कम रोशनी में फ़ोटो फीकी आती हैं", te: "తక్కువ వెలుతురులో ఫోటోలు మసకగా ఉంటాయి" },
  },
  screen: {
    pos: { en: "screen is bright and easy to read", hi: "स्क्रीन चमकदार और पढ़ने में आसान है", te: "స్క్రీన్ ప్రకాశవంతంగా, చదవడానికి సులభంగా ఉంది" },
    neg: { en: "screen is hard to read in sunlight", hi: "धूप में स्क्रीन पढ़ना मुश्किल है", te: "ఎండలో స్క్రీన్ చదవడం కష్టం" },
  },
  speed: {
    pos: { en: "runs smoothly", hi: "बिना अटके चलता है", te: "సాఫీగా నడుస్తుంది" },
    neg: { en: "hangs sometimes", hi: "कभी कभी अटकता है", te: "కొన్నిసార్లు ఆగిపోతుంది" },
  },
  sound: {
    pos: { en: "sound is clear", hi: "आवाज़ साफ़ है", te: "శబ్దం స్పష్టంగా ఉంది" },
    neg: { en: "sound is weak", hi: "आवाज़ कमज़ोर है", te: "శబ్దం బలహీనంగా ఉంది" },
  },
  fit: {
    pos: { en: "fits well", hi: "फिटिंग अच्छी है", te: "బాగా సరిపోతుంది" },
    neg: { en: "fit is off, check the size chart", hi: "फिटिंग ठीक नहीं, साइज़ चार्ट देखें", te: "సరిపోదు, సైజ్ చార్ట్ చూడండి" },
  },
  fabric: {
    pos: { en: "soft, comfortable fabric", hi: "कपड़ा मुलायम और आरामदायक है", te: "బట్ట మెత్తగా, సౌకర్యంగా ఉంది" },
    neg: { en: "fabric feels rough", hi: "कपड़ा खुरदरा लगता है", te: "బట్ట గరుకుగా ఉంది" },
  },
  colour: {
    pos: { en: "colour is as shown", hi: "रंग फ़ोटो जैसा ही है", te: "రంగు ఫోటోలో ఉన్నట్లే ఉంది" },
    neg: { en: "colour looks different from the photo", hi: "रंग फ़ोटो से अलग है", te: "రంగు ఫోటోకు భిన్నంగా ఉంది" },
  },
  wash: {
    pos: { en: "colour holds after washing", hi: "धोने के बाद रंग नहीं उतरता", te: "ఉతికాక రంగు పోదు" },
    neg: { en: "fades after washing", hi: "धोने के बाद रंग उतरता है", te: "ఉతికాక రంగు వెలిసిపోతుంది" },
  },
  noise: {
    pos: { en: "runs quietly", hi: "आवाज़ कम करता है", te: "శబ్దం తక్కువగా ఉంది" },
    neg: { en: "makes noise", hi: "आवाज़ करता है", te: "శబ్దం చేస్తుంది" },
  },
  brightness: {
    pos: { en: "bright light", hi: "रोशनी तेज़ है", te: "వెలుతురు ఎక్కువగా ఉంది" },
    neg: { en: "light is dim", hi: "रोशनी कम है", te: "వెలుతురు తక్కువగా ఉంది" },
  },
  delivery: {
    pos: { en: "arrived on time", hi: "समय पर पहुँचा", te: "సమయానికి వచ్చింది" },
    neg: { en: "came late", hi: "देर से आया", te: "ఆలస్యంగా వచ్చింది" },
  },
  packing: {
    pos: { en: "well packed", hi: "अच्छी पैकिंग", te: "బాగా ప్యాక్ చేశారు" },
    neg: { en: "packing was poor", hi: "पैकिंग ठीक नहीं थी", te: "ప్యాకింగ్ బాగాలేదు" },
  },
  airflow: {
    pos: { en: "good air throw", hi: "हवा अच्छी देता है", te: "గాలి బాగా వస్తుంది" },
    neg: { en: "air is weak", hi: "हवा कम आती है", te: "గాలి తక్కువగా వస్తుంది" },
  },
  anc: {
    pos: { en: "blocks background noise well", hi: "बाहर का शोर अच्छे से रोकता है", te: "బయటి శబ్దాన్ని బాగా అడ్డుకుంటుంది" },
    neg: { en: "noise cancelling is weak", hi: "शोर रोकना कमज़ोर है", te: "శబ్దం అడ్డుకోవడం బలహీనం" },
  },
  comfort: {
    pos: { en: "comfortable to wear for hours", hi: "घंटों पहनने में आरामदायक", te: "గంటల తరబడి ధరించడానికి సౌకర్యం" },
    neg: { en: "uncomfortable after a while", hi: "थोड़ी देर बाद असहज लगता है", te: "కొంతసేపటి తర్వాత అసౌకర్యంగా ఉంటుంది" },
  },
  connect: {
    pos: { en: "connects fast and stays connected", hi: "जल्दी जुड़ता है और जुड़ा रहता है", te: "త్వరగా కనెక్ట్ అవుతుంది, కనెక్షన్ నిలుస్తుంది" },
    neg: { en: "disconnects now and then", hi: "बीच बीच में कनेक्शन टूटता है", te: "అప్పుడప్పుడు కనెక్షన్ తెగుతుంది" },
  },
  calls: {
    pos: { en: "calls are clear", hi: "कॉल की आवाज़ साफ़ है", te: "కాల్స్ స్పష్టంగా ఉన్నాయి" },
    neg: { en: "the other person hears you poorly", hi: "सामने वाले को आपकी आवाज़ कम सुनाई देती है", te: "అవతలి వ్యక్తికి మీ గొంతు సరిగా వినిపించదు" },
  },
  grip: {
    pos: { en: "good grip on wet floors", hi: "गीले फ़र्श पर अच्छी पकड़", te: "తడి నేలపై మంచి పట్టు" },
    neg: { en: "slippery on wet floors", hi: "गीले फ़र्श पर फिसलता है", te: "తడి నేలపై జారుతుంది" },
  },
  looks: {
    pos: { en: "looks smart", hi: "देखने में अच्छा लगता है", te: "చూడటానికి బాగుంది" },
    neg: { en: "looks plain in person", hi: "सामने से साधारण दिखता है", te: "ప్రత్యక్షంగా సాధారణంగా కనిపిస్తుంది" },
  },
};
