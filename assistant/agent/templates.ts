import type { L3, Lang } from "@/contract/lang";
import { LANG_TAG } from "@/contract/lang";
import { rupeesWord, spellDigits } from "@/assistant/speakable";
import type { Payment, ReasonCode as Reason } from "@/contract";

/**
 * Every sentence Omnikart can say, in three languages, with slots for numbers and names.
 * Numbers are always filled in by code from catalogue data, never by the LLM.
 * Hindi and Telugu were drafted by the assistant; read them aloud once and fix anything unnatural.
 */

export type Slot = string | number | { money: number } | { dec: number } | { digits: string } | { n: number };

/** One thing Omnikart says. `caption` is for the eyes, `speech` is for the voice. */
export interface Line {
  caption: string;
  speech: string;
  /** element id to highlight while this line is spoken */
  focus?: string;
  /** calm mode: one large fact per screen */
  card?: { step: number; of: number; title: string; value: string };
  /** part of the checkout read-back */
  readback?: boolean;
  /** language to speak this line in when it must differ from the reply language */
  lang?: Lang;
}

const t = (en: string, hi: string, te: string): L3 => ({ en, hi, te });

export const T = {
  option: t(
    "Number {i}: {name}, {price}. {reason}",
    "नंबर {i}: {name}, {price}। {reason}",
    "నంబర్ {i}: {name}, {price}. {reason}",
  ),
  product_head: t("{name}. {price}.", "{name}। {price}।", "{name}. {price}."),
  product_rating: t(
    "Rated {rating} out of five by {count} shoppers.",
    "{count} खरीदारों ने इसे पाँच में से {rating} रेटिंग दी है।",
    "{count} మంది కొనుగోలుదారులు దీనికి ఐదుకు {rating} రేటింగ్ ఇచ్చారు.",
  ),
  product_delivery: t("Delivery in {days} days.", "डिलीवरी {days} दिन में।", "డెలివరీ {days} రోజుల్లో."),
  product_low_stock: t("Only {stock} left.", "सिर्फ़ {stock} बचे हैं।", "కేవలం {stock} మిగిలి ఉన్నాయి."),
  product_access_hint: t(
    "Shoppers with disabilities have left notes. Say reviews to hear them first.",
    "विकलांग खरीदारों ने नोट छोड़े हैं। उन्हें पहले सुनने के लिए रिव्यू बोलिए।",
    "దివ్యాంగ కొనుగోలుదారులు నోట్లు రాశారు. వాటిని ముందు వినడానికి రివ్యూలు అని చెప్పండి.",
  ),
  top_facts_intro: t("Key things to know about {name}.", "{name} के बारे में ज़रूरी बातें।", "{name} గురించి ముఖ్య విషయాలు."),
  simple_intro: t("In simple words.", "आसान शब्दों में।", "సులభమైన మాటల్లో."),
  simple_none: t(
    "I do not have a simpler version for this one.",
    "इसके लिए मेरे पास आसान रूप नहीं है।",
    "దీనికి నా దగ్గర సులభమైన రూపం లేదు.",
  ),
  simple_need_product: t(
    "Open a product first, then I can explain it in simple words.",
    "पहले कोई प्रोडक्ट खोलिए, फिर मैं आसान शब्दों में समझाऊँगी।",
    "ముందు ఒక ఉత్పత్తిని తెరవండి, తర్వాత సులభంగా వివరిస్తాను.",
  ),
  access_intro: t(
    "{n} shoppers with disabilities left notes.",
    "{n} विकलांग खरीदारों ने नोट छोड़े हैं।",
    "{n} మంది దివ్యాంగ కొనుగోలుదారులు నోట్లు రాశారు.",
  ),
  access_note: t("{by} says: {text}", "{by} कहते हैं: {text}", "{by} ఇలా అన్నారు: {text}"),
  reviews_head: t(
    "Based on {n} written reviews, rated {rating} out of five.",
    "{n} लिखित रिव्यू के आधार पर, पाँच में से {rating} रेटिंग।",
    "{n} రాతపూర్వక రివ్యూల ఆధారంగా, ఐదుకు {rating} రేటింగ్.",
  ),
  reviews_liked: t("People liked: {list}.", "लोगों को पसंद आया: {list}।", "ప్రజలకు నచ్చినవి: {list}."),
  reviews_disliked: t("People did not like: {list}.", "लोगों को पसंद नहीं आया: {list}।", "ప్రజలకు నచ్చనివి: {list}."),
  reviews_no_complaints: t(
    "Nobody complained about anything often.",
    "किसी चीज़ की ज़्यादा शिकायत नहीं आई।",
    "ఎవరూ ఏ విషయంపైనా ఎక్కువగా ఫిర్యాదు చేయలేదు.",
  ),
  verdict_happy: t(
    "The verdict: most buyers are happy. A good choice.",
    "निष्कर्ष: ज़्यादातर खरीदार खुश हैं। अच्छा चुनाव है।",
    "తీర్పు: చాలా మంది కొనుగోలుదారులు సంతోషంగా ఉన్నారు. మంచి ఎంపిక.",
  ),
  verdict_mostly: t(
    "The verdict: mostly good, with a few complaints.",
    "निष्कर्ष: ज़्यादातर अच्छा, कुछ शिकायतों के साथ।",
    "తీర్పు: ఎక్కువగా బాగుంది, కొన్ని ఫిర్యాదులతో.",
  ),
  verdict_mixed: t(
    "The verdict: mixed. Read the complaints before you buy.",
    "निष्कर्ष: मिला जुला। खरीदने से पहले शिकायतें सुन लीजिए।",
    "తీర్పు: మిశ్రమం. కొనే ముందు ఫిర్యాదులు వినండి.",
  ),
  photo_catalogue: t("The photo shows {look}", "फ़ोटो में दिखता है: {look}", "ఫోటోలో కనిపిస్తున్నది: {look}"),
  photo_llm: t("It looks like {look}", "ऐसा लगता है: {look}", "ఇలా కనిపిస్తోంది: {look}"),
  size_none: t(
    "This product does not come in sizes.",
    "यह प्रोडक्ट साइज़ में नहीं आता।",
    "ఈ ఉత్పత్తి సైజుల్లో రాదు.",
  ),
  compare_head: t("Comparing {a} and {b}.", "{a} और {b} की तुलना।", "{a} మరియు {b} పోలిక."),
  compare_line: t(
    "{name}: {price}, rated {rating} out of five.",
    "{name}: {price}, पाँच में से {rating} रेटिंग।",
    "{name}: {price}, ఐదుకు {rating} రేటింగ్.",
  ),
  compare_diff: t(
    "The main difference is {label}: {a} has {va}, {b} has {vb}.",
    "मुख्य अंतर {label} का है: {a} में {va}, {b} में {vb}।",
    "ప్రధాన తేడా {label}: {a}లో {va}, {b}లో {vb}.",
  ),
  compare_diff_price: t(
    "The main difference is the price: {a} is {pa}, {b} is {pb}.",
    "मुख्य अंतर कीमत का है: {a} {pa} का है, {b} {pb} का।",
    "ప్రధాన తేడా ధర: {a} {pa}, {b} {pb}.",
  ),
  compare_need_two: t(
    "I need two products to compare. Ask for something first.",
    "तुलना के लिए दो प्रोडक्ट चाहिए। पहले कुछ खोजिए।",
    "పోలికకు రెండు ఉత్పత్తులు కావాలి. ముందు ఏదైనా వెతకండి.",
  ),
  ask_unknown: t("The seller has not said.", "विक्रेता ने यह नहीं बताया है।", "విక్రేత దీని గురించి చెప్పలేదు."),
  ask_need_product: t(
    "Open a product first, then ask me about it.",
    "पहले कोई प्रोडक्ट खोलिए, फिर उसके बारे में पूछिए।",
    "ముందు ఒక ఉత్పత్తిని తెరవండి, తర్వాత దాని గురించి అడగండి.",
  ),
  need_product: t(
    "Please pick a product first. Say first, second or third.",
    "पहले कोई प्रोडक्ट चुनिए। पहला, दूसरा या तीसरा बोलिए।",
    "ముందు ఒక ఉత్పత్తిని ఎంచుకోండి. మొదటిది, రెండవది లేదా మూడవది అని చెప్పండి.",
  ),
  cart_added: t(
    "Added {name}. Items in your cart: {count}. Total {total}.",
    "{name} जोड़ दिया। आपके कार्ट में {count} सामान हैं, कुल {total}।",
    "{name} జోడించాను. మీ కార్ట్‌లో {count} వస్తువులు ఉన్నాయి, మొత్తం {total}.",
  ),
  cart_added_hint: t(
    "Say checkout when you are ready.",
    "तैयार हों तो चेकआउट बोलिए।",
    "సిద్ధంగా ఉన్నప్పుడు చెక్‌అవుట్ అని చెప్పండి.",
  ),
  cart_removed: t(
    "Removed {name}. Items in your cart: {count}.",
    "{name} हटा दिया। आपके कार्ट में {count} सामान हैं।",
    "{name} తీసివేశాను. మీ కార్ట్‌లో {count} వస్తువులు ఉన్నాయి.",
  ),
  cart_not_in: t(
    "That item is not in your cart.",
    "यह सामान आपके कार्ट में नहीं है।",
    "ఆ వస్తువు మీ కార్ట్‌లో లేదు.",
  ),
  cart_empty: t("Your cart is empty.", "आपका कार्ट खाली है।", "మీ కార్ట్ ఖాళీగా ఉంది."),
  cart_head: t("Items in your cart: {count}.", "आपके कार्ट में {count} सामान हैं।", "మీ కార్ట్‌లో {count} వస్తువులు ఉన్నాయి."),
  cart_line: t(
    "{qty} of {name}, {price} each.",
    "{qty} {name}, हर एक {price}।",
    "{qty} {name}, ఒక్కొక్కటి {price}.",
  ),
  cart_total: t("Total {total}.", "कुल {total}।", "మొత్తం {total}."),
  checkout_empty: t(
    "Your cart is empty, so there is nothing to pay for.",
    "आपका कार्ट खाली है, इसलिए भुगतान के लिए कुछ नहीं है।",
    "మీ కార్ట్ ఖాళీగా ఉంది, కాబట్టి చెల్లించడానికి ఏమీ లేదు.",
  ),
  rb_intro: t(
    "Please listen before you pay.",
    "भुगतान से पहले कृपया सुन लीजिए।",
    "చెల్లించే ముందు దయచేసి వినండి.",
  ),
  rb_items: t("You are buying: {items}.", "आप ये खरीद रहे हैं: {items}।", "మీరు కొంటున్నవి: {items}."),
  rb_address: t("Deliver to: {address}", "यहाँ पहुँचाया जाएगा: {address}", "ఇక్కడికి డెలివరీ: {address}"),
  rb_delivery: t("Delivery by {date}.", "{date} तक डिलीवरी।", "{date} లోపు డెలివరీ."),
  rb_payment: t("Payment: {method}.", "भुगतान: {method}।", "చెల్లింపు: {method}."),
  rb_total: t("The total is {total}.", "कुल राशि {total} है।", "మొత్తం {total}."),
  rb_digits: t(
    "Again, digit by digit: {digits}.",
    "फिर से, अंक दर अंक: {digits}।",
    "మళ్ళీ, అంకె అంకెగా: {digits}.",
  ),
  rb_confirm: t(
    "To place the order, say: yes, place order. To cancel, say: cancel.",
    "ऑर्डर देने के लिए बोलिए: हाँ, ऑर्डर करो। रद्द करने के लिए बोलिए: रद्द।",
    "ఆర్డర్ చేయడానికి చెప్పండి: అవును, ఆర్డర్ చేయండి. రద్దు చేయడానికి చెప్పండి: రద్దు.",
  ),
  checkout_need_summary: t(
    "I stopped the summary, so nothing is ordered. Say repeat to hear it again, then say: yes, place order.",
    "मैंने सार रोक दिया, इसलिए कुछ ऑर्डर नहीं हुआ। फिर से सुनने के लिए दोहराओ बोलिए, फिर बोलिए: हाँ, ऑर्डर करो।",
    "నేను సారాంశాన్ని ఆపాను, కాబట్టి ఏదీ ఆర్డర్ కాలేదు. మళ్ళీ వినడానికి మళ్ళీ చెప్పండి అనండి, తర్వాత: అవును, ఆర్డర్ చేయండి.",
  ),
  ordered: t(
    "Your order is placed. Order number {digits}. Delivery by {date}. Say my order any time to hear this again.",
    "आपका ऑर्डर हो गया। ऑर्डर नंबर {digits}। {date} तक डिलीवरी। दोबारा सुनने के लिए कभी भी मेरा ऑर्डर बोलिए।",
    "మీ ఆర్డర్ పూర్తయింది. ఆర్డర్ నంబర్ {digits}. {date} లోపు డెలివరీ. మళ్ళీ వినడానికి ఎప్పుడైనా నా ఆర్డర్ అని చెప్పండి.",
  ),
  checkout_cancelled: t(
    "Okay, I have not placed the order. Your cart is safe.",
    "ठीक है, मैंने ऑर्डर नहीं किया। आपका कार्ट सुरक्षित है।",
    "సరే, ఆర్డర్ చేయలేదు. మీ కార్ట్ భద్రంగా ఉంది.",
  ),
  track_none: t("You have no orders yet.", "आपका अभी कोई ऑर्डर नहीं है।", "మీకు ఇంకా ఆర్డర్లు లేవు."),
  track_line: t(
    "Order {digits} is {status}. Delivery by {date}.",
    "ऑर्डर {digits} {status}। {date} तक डिलीवरी।",
    "ఆర్డర్ {digits} {status}. {date} లోపు డెలివరీ.",
  ),
  status_packed: t("packed and ready to ship", "पैक हो गया है और भेजने के लिए तैयार है", "ప్యాక్ చేయబడి, పంపడానికి సిద్ధంగా ఉంది"),
  status_return: t("marked for return", "वापसी के लिए दर्ज है", "తిరిగి ఇవ్వడానికి నమోదు చేయబడింది"),
  return_done: t(
    "I have noted a return request for order {digits}. The seller will contact you.",
    "मैंने ऑर्डर {digits} की वापसी का अनुरोध दर्ज कर लिया। विक्रेता आपसे संपर्क करेगा।",
    "ఆర్డర్ {digits} తిరిగి ఇచ్చే అభ్యర్థనను నమోదు చేశాను. విక్రేత మిమ్మల్ని సంప్రదిస్తారు.",
  ),
  out_of_scope: t(
    "I can only help with shopping, and I read out what the seller says. I cannot give medical, legal or financial advice.",
    "मैं सिर्फ़ खरीदारी में मदद कर सकती हूँ, और विक्रेता ने जो लिखा है वही पढ़ती हूँ। मैं चिकित्सा, कानूनी या वित्तीय सलाह नहीं दे सकती।",
    "నేను షాపింగ్‌లో మాత్రమే సహాయం చేయగలను, విక్రేత రాసినదే చదువుతాను. వైద్య, న్యాయ, ఆర్థిక సలహా ఇవ్వలేను.",
  ),
  where_home: t("You are on the home page.", "आप होम पेज पर हैं।", "మీరు హోమ్ పేజీలో ఉన్నారు."),
  where_options: t("{n} options are on offer.", "{n} विकल्प सामने हैं।", "{n} ఎంపికలు ఉన్నాయి."),
  where_product: t("You are looking at {name}.", "आप {name} देख रहे हैं।", "మీరు {name} చూస్తున్నారు."),
  where_cart: t("You are in your cart. Items: {count}.", "आप अपने कार्ट में हैं, {count} सामान के साथ।", "మీరు మీ కార్ట్‌లో ఉన్నారు, {count} వస్తువులతో."),
  where_checkout: t("You are at checkout. Items: {count}. Total {total}.", "आप चेकआउट पर हैं। {count} सामान, कुल {total}।", "మీరు చెక్‌అవుట్‌లో ఉన్నారు. {count} వస్తువులు, మొత్తం {total}."),
  where_ordered: t("Your order is placed.", "आपका ऑर्डर हो चुका है।", "మీ ఆర్డర్ పూర్తయింది."),
  repeat_none: t("I have nothing to repeat yet.", "अभी दोहराने के लिए कुछ नहीं है।", "ఇంకా మళ్ళీ చెప్పడానికి ఏమీ లేదు."),
  going_back: t("Going back.", "वापस जा रही हूँ।", "వెనక్కి వెళ్తున్నాను."),
  start_over: t(
    "Starting over. What would you like to buy?",
    "फिर से शुरू करते हैं। आप क्या खरीदना चाहेंगे?",
    "మళ్ళీ మొదలుపెడదాం. మీరు ఏమి కొనాలనుకుంటున్నారు?",
  ),
  not_understood: t(
    "Sorry, I did not understand. You can say help.",
    "माफ़ कीजिए, मैं समझ नहीं पाई। आप मदद बोल सकते हैं।",
    "క్షమించండి, నాకు అర్థం కాలేదు. మీరు సహాయం అని చెప్పవచ్చు.",
  ),
  heard_confirm: t("I heard: {text}. Is that right?", "मैंने सुना: {text}। क्या यह सही है?", "నేను విన్నది: {text}. ఇది సరైనదేనా?"),
  say_again: t("Please say that again.", "कृपया फिर से बोलिए।", "దయచేసి మళ్ళీ చెప్పండి."),
  offer_motor: t(
    "Would you like to shop with one key? I will read each choice, and you press space to pick the one you hear.",
    "क्या आप एक ही बटन से खरीदारी करना चाहेंगे? मैं हर विकल्प पढ़ूँगी, और जो सुनाई दे उसे चुनने के लिए स्पेस दबाइए।",
    "మీరు ఒకే కీతో షాపింగ్ చేయాలనుకుంటున్నారా? నేను ప్రతి ఎంపికను చదువుతాను, మీరు వినిపించినదాన్ని ఎంచుకోవడానికి స్పేస్ నొక్కండి.",
  ),
  offer_calm: t(
    "Would you like me to speak slower and show one thing at a time?",
    "क्या आप चाहेंगे कि मैं धीरे बोलूँ और एक बार में एक ही चीज़ दिखाऊँ?",
    "నేను నెమ్మదిగా మాట్లాడి, ఒక్కసారికి ఒక్కటే చూపించాలా?",
  ),
  offer_contrast: t(
    "Would you like larger text and stronger colours?",
    "क्या आप बड़े अक्षर और गहरे रंग चाहेंगे?",
    "పెద్ద అక్షరాలు, గాఢమైన రంగులు కావాలా?",
  ),
  accepted_motor: t(
    "One key mode is on. I will read the choices. Press space to pick the one you hear.",
    "एक बटन मोड चालू है। मैं विकल्प पढ़ूँगी। जो सुनाई दे उसे चुनने के लिए स्पेस दबाइए।",
    "ఒక కీ మోడ్ ఆన్ అయింది. నేను ఎంపికలను చదువుతాను. వినిపించినదాన్ని ఎంచుకోవడానికి స్పేస్ నొక్కండి.",
  ),
  accepted_calm: t(
    "Calm mode is on. I will speak slower and show one thing at a time.",
    "शांत मोड चालू है। मैं धीरे बोलूँगी और एक बार में एक चीज़ दिखाऊँगी।",
    "ప్రశాంత మోడ్ ఆన్ అయింది. నేను నెమ్మదిగా మాట్లాడతాను, ఒక్కసారికి ఒక్కటే చూపిస్తాను.",
  ),
  accepted_contrast: t(
    "Larger text and stronger colours are on.",
    "बड़े अक्षर और गहरे रंग चालू हैं।",
    "పెద్ద అక్షరాలు, గాఢమైన రంగులు ఆన్ అయ్యాయి.",
  ),
  offer_declined: t(
    "Okay, I will keep things as they are.",
    "ठीक है, मैं सब कुछ वैसा ही रखूँगी।",
    "సరే, అన్నీ ఇలాగే ఉంచుతాను.",
  ),
  speed_slower: t("Speaking slower.", "धीरे बोल रही हूँ।", "నెమ్మదిగా మాట్లాడుతున్నాను."),
  speed_faster: t("Speaking faster.", "तेज़ बोल रही हूँ।", "వేగంగా మాట్లాడుతున్నాను."),
  speed_min: t("This is already the slowest speed.", "यह पहले से सबसे धीमी गति है।", "ఇది ఇప్పటికే అతి నెమ్మది వేగం."),
  speed_max: t("This is already the fastest speed.", "यह पहले से सबसे तेज़ गति है।", "ఇది ఇప్పటికే అతి వేగమైనది."),
  err_mic: t(
    "I cannot hear you. Please allow the microphone, or type your request in the box.",
    "मैं आपको सुन नहीं पा रही। कृपया माइक की अनुमति दीजिए, या डिब्बे में लिखिए।",
    "నాకు మీ మాట వినిపించడం లేదు. దయచేసి మైక్రోఫోన్ అనుమతించండి, లేదా పెట్టెలో టైప్ చేయండి.",
  ),
  err_no_speech: t(
    "I did not hear anything. Tap and speak.",
    "मुझे कुछ सुनाई नहीं दिया। दबाइए और बोलिए।",
    "నాకు ఏమీ వినిపించలేదు. నొక్కి మాట్లాడండి.",
  ),
  err_asr_empty: t(
    "I did not catch that. Please say it again.",
    "मैं समझ नहीं पाई। कृपया फिर से बोलिए।",
    "నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ చెప్పండి.",
  ),
  err_asr_slow: t(
    "Sorry, I am slow just now. Please say it once more.",
    "माफ़ कीजिए, अभी मैं धीमी हूँ। कृपया एक बार और बोलिए।",
    "క్షమించండి, ఇప్పుడు నేను నెమ్మదిగా ఉన్నాను. దయచేసి ఒక్కసారి మళ్ళీ చెప్పండి.",
  ),
  err_offline: t(
    "Connection lost. I will retry when you are back online.",
    "कनेक्शन टूट गया। आपके ऑनलाइन आते ही मैं फिर कोशिश करूँगी।",
    "కనెక్షన్ పోయింది. మీరు ఆన్‌లైన్‌కు వచ్చాక మళ్ళీ ప్రయత్నిస్తాను.",
  ),
  back_online: t("You are back online. Trying again.", "आप फिर से ऑनलाइन हैं। दोबारा कोशिश कर रही हूँ।", "మీరు మళ్ళీ ఆన్‌లైన్‌లో ఉన్నారు. మళ్ళీ ప్రయత్నిస్తున్నాను."),
  err_busy: t(
    "Many people are shopping right now. One moment, please.",
    "अभी बहुत लोग खरीदारी कर रहे हैं। कृपया एक पल रुकिए।",
    "ఇప్పుడు చాలా మంది షాపింగ్ చేస్తున్నారు. దయచేసి ఒక్క క్షణం.",
  ),
  err_generic: t(
    "Something went wrong. Please try again.",
    "कुछ गड़बड़ हो गई। कृपया फिर कोशिश कीजिए।",
    "ఏదో తప్పు జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
  ),
  intro: t(
    "Namaste. I am Omnikart, your shopping guide on {store}. I can find things, read reviews and place your order. What would you like to buy today?",
    "नमस्ते। मैं ओम्नीकार्ट हूँ, {store} पर आपकी खरीदारी की साथी। मैं चीज़ें ढूँढ सकती हूँ, रिव्यू पढ़ सकती हूँ और आपका ऑर्डर कर सकती हूँ। आज आप क्या खरीदना चाहेंगे?",
    "నమస్కారం. నేను ఓమ్నీకార్ట్, {store}లో మీ షాపింగ్ సహాయకురాలిని. నేను వస్తువులను వెతకగలను, రివ్యూలు చదవగలను, మీ ఆర్డర్ చేయగలను. ఈరోజు మీరు ఏమి కొనాలనుకుంటున్నారు?",
  ),
  clarify: t(
    "What would you like to buy? For example: {list}.",
    "आप क्या खरीदना चाहेंगे? जैसे: {list}।",
    "మీరు ఏమి కొనాలనుకుంటున్నారు? ఉదాహరణకు: {list}.",
  ),
  flow_start: t(
    "{what}. I have {n} to choose from. I can narrow them down by {list}. Say skip any time if a question does not matter to you.",
    "{what}। मेरे पास चुनने के लिए {n} हैं। मैं इन्हें {list} के हिसाब से छाँट सकती हूँ। कोई सवाल ज़रूरी न लगे तो कभी भी छोड़ो बोलिए।",
    "{what}. ఎంచుకోవడానికి నా దగ్గర {n} ఉన్నాయి. వీటిని {list} ఆధారంగా తగ్గించగలను. ఏ ప్రశ్న అవసరం లేదనిపిస్తే ఎప్పుడైనా వదిలేయండి అని చెప్పండి.",
  ),
  ask_options: t(
    "{question} {options}.",
    "{question} {options}।",
    "{question} {options}.",
  ),
  ask_bool: t(
    "{question} Say yes or no.",
    "{question} हाँ या नहीं बोलिए।",
    "{question} అవును లేదా కాదు అని చెప్పండి.",
  ),
  ask_plain: t(
    "{question}",
    "{question}",
    "{question}",
  ),
  ask_other: t(
    "Or name another one.",
    "या कोई और बताइए।",
    "లేదా మరొకటి చెప్పండి.",
  ),
  filter_set: t(
    "Got it: {label}. {n} left.",
    "ठीक है: {label}। {n} बचे हैं।",
    "సరే: {label}. {n} మిగిలాయి.",
  ),
  filter_skipped: t(
    "Okay, skipping {title}.",
    "ठीक है, {title} छोड़ रही हूँ।",
    "సరే, {title} వదిలేస్తున్నాను.",
  ),
  filter_none: t(
    "Nothing matches {label} with your other choices, so I did not add it.",
    "आपकी बाक़ी पसंद के साथ {label} का कुछ नहीं मिला, इसलिए मैंने इसे नहीं जोड़ा।",
    "మీ ఇతర ఎంపికలతో {label}కు ఏదీ సరిపోలలేదు, కాబట్టి దాన్ని చేర్చలేదు.",
  ),
  filter_unclear: t(
    "I did not catch that.",
    "मैं समझ नहीं पाई।",
    "నాకు అర్థం కాలేదు.",
  ),
  filters_restart: t(
    "Okay, let us choose the filters again.",
    "ठीक है, फ़िल्टर फिर से चुनते हैं।",
    "సరే, ఫిల్టర్లను మళ్ళీ ఎంచుకుందాం.",
  ),
  filters_current: t(
    "Your filters: {list}.",
    "आपके फ़िल्टर: {list}।",
    "మీ ఫిల్టర్లు: {list}.",
  ),
  matches_head: t(
    "{m} of {total} {what} match. Here are the best {n}.",
    "{total} {what} में से {m} मेल खाते हैं। ये रहे सबसे अच्छे {n}।",
    "{total} {what}లో {m} సరిపోతాయి. వీటిలో ఉత్తమ {n} ఇవి.",
  ),
  matches_few: t(
    "Only {m} of {total} {what} match.",
    "{total} {what} में से सिर्फ़ {m} मेल खाते हैं।",
    "{total} {what}లో కేవలం {m} సరిపోతాయి.",
  ),
  matches_relaxed: t(
    "Nothing matched everything, so I dropped {dropped}. Now {m} match.",
    "सब कुछ मेल नहीं खाया, इसलिए मैंने {dropped} हटा दिया। अब {m} मेल खाते हैं।",
    "అన్నీ సరిపోలలేదు, కాబట్టి {dropped} తొలగించాను. ఇప్పుడు {m} సరిపోతాయి.",
  ),
  matches_next: t(
    "Say first, second or third to hear more. Or say change filters.",
    "ज़्यादा सुनने के लिए पहला, दूसरा या तीसरा बोलिए। या फ़िल्टर बदलो बोलिए।",
    "మరింత వినడానికి మొదటిది, రెండవది లేదా మూడవది అని చెప్పండి. లేదా ఫిల్టర్లు మార్చండి అనండి.",
  ),
  matches_next_one: t(
    "Say first to hear more. Or say change filters.",
    "ज़्यादा सुनने के लिए पहला बोलिए। या फ़िल्टर बदलो बोलिए।",
    "మరింత వినడానికి మొదటిది అని చెప్పండి. లేదా ఫిల్టర్లు మార్చండి అనండి.",
  ),
  matches_next_two: t(
    "Say first or second to hear more. Or say change filters.",
    "ज़्यादा सुनने के लिए पहला या दूसरा बोलिए। या फ़िल्टर बदलो बोलिए।",
    "మరింత వినడానికి మొదటిది లేదా రెండవది అని చెప్పండి. లేదా ఫిల్టర్లు మార్చండి అనండి.",
  ),
  product_hint: t(
    "Say reviews, delivery, photo, or add to cart.",
    "रिव्यू, डिलीवरी, फ़ोटो, या कार्ट में डालो बोलिए।",
    "రివ్యూలు, డెలివరీ, ఫోటో, లేదా కార్ట్‌లో వేయండి అని చెప్పండి.",
  ),
  reviews_next: t(
    "Say delivery to hear when it will arrive.",
    "कब पहुँचेगा यह सुनने के लिए डिलीवरी बोलिए।",
    "ఎప్పుడు చేరుతుందో వినడానికి డెలివరీ అని చెప్పండి.",
  ),
  delivery_dispatch: t(
    "If you order today, it ships on {ship}.",
    "आज ऑर्डर करें तो यह {ship} को भेजा जाएगा।",
    "ఈరోజు ఆర్డర్ చేస్తే {ship}న పంపబడుతుంది.",
  ),
  delivery_arrive: t(
    "It reaches {address} by {date}.",
    "यह {date} तक {address} पहुँचेगा।",
    "ఇది {date} లోపు {address}కు చేరుతుంది.",
  ),
  delivery_free: t(
    "Delivery is free.",
    "डिलीवरी मुफ़्त है।",
    "డెలివరీ ఉచితం.",
  ),
  delivery_return: t(
    "You can return it within {days} days.",
    "आप इसे {days} दिन में वापस कर सकते हैं।",
    "మీరు దీన్ని {days} రోజుల్లో తిరిగి ఇవ్వవచ్చు.",
  ),
  delivery_seller: t(
    "Sold by {seller}.",
    "विक्रेता: {seller}।",
    "అమ్మకందారు: {seller}.",
  ),
  delivery_stock: t(
    "It is in stock.",
    "यह स्टॉक में है।",
    "ఇది స్టాక్‌లో ఉంది.",
  ),
  delivery_next: t(
    "Say add to cart to buy it.",
    "खरीदने के लिए कार्ट में डालो बोलिए।",
    "కొనడానికి కార్ట్‌లో వేయండి అని చెప్పండి.",
  ),
  size_available: t(
    "Sizes in stock: {list}.",
    "उपलब्ध साइज़: {list}।",
    "అందుబాటులో ఉన్న సైజులు: {list}.",
  ),
  size_yes: t(
    "Size {size} is in stock.",
    "साइज़ {size} उपलब्ध है।",
    "సైజ్ {size} అందుబాటులో ఉంది.",
  ),
  size_no: t(
    "Size {size} is not in stock. Sizes in stock: {list}.",
    "साइज़ {size} उपलब्ध नहीं है। उपलब्ध साइज़: {list}।",
    "సైజ్ {size} అందుబాటులో లేదు. అందుబాటులో ఉన్న సైజులు: {list}.",
  ),
  where_results: t(
    "You are looking at search results for {what}.",
    "आप {what} के नतीजे देख रहे हैं।",
    "మీరు {what} శోధన ఫలితాలు చూస్తున్నారు.",
  ),
  help: t(
    "You can say: show me {example}. I will ask about your budget and brand, then suggest the best matches. Then say first, second or third. Ask for reviews, delivery, a photo or key facts. Say add to cart, then checkout. Say skip, slower, repeat or stop at any time.",
    "आप बोल सकते हैं: {example} दिखाओ। मैं आपका बजट और ब्रांड पूछूँगी, फिर सबसे अच्छे विकल्प बताऊँगी। फिर पहला, दूसरा या तीसरा बोलिए। रिव्यू, डिलीवरी, फ़ोटो या ज़रूरी बातें माँगिए। कार्ट में डालो, फिर चेकआउट बोलिए। कभी भी छोड़ो, धीरे, दोहराओ या रुको बोल सकते हैं।",
    "మీరు ఇలా చెప్పవచ్చు: {example} చూపించు. నేను మీ బడ్జెట్, బ్రాండ్ అడిగి, ఉత్తమ ఎంపికలు సూచిస్తాను. తర్వాత మొదటిది, రెండవది లేదా మూడవది అనండి. రివ్యూలు, డెలివరీ, ఫోటో లేదా ముఖ్య విషయాలు అడగండి. కార్ట్‌లో వేయి, తర్వాత చెక్‌అవుట్ అనండి. ఎప్పుడైనా వదిలేయండి, నెమ్మదిగా, మళ్ళీ లేదా ఆపండి అనవచ్చు.",
  ),
} satisfies Record<string, L3>;

export type TemplateId = keyof typeof T;

/** Reasons we give for each option. */
export const REASON: Record<Reason, L3> = {
  cheapest: t("It is the cheapest of these.", "यह इनमें सबसे सस्ता है।", "ఇవన్నిటిలో ఇదే చవక."),
  top_rated: t("It has the best rating of these.", "इनमें इसकी रेटिंग सबसे अच्छी है।", "వీటిలో దీనికి ఉత్తమ రేటింగ్ ఉంది."),
  best_seller: t("It is a best seller.", "यह सबसे ज़्यादा बिकने वाला है।", "ఇది ఎక్కువగా అమ్ముడవుతున్నది."),
  touch: t("It is easy to use by touch.", "इसे छूकर इस्तेमाल करना आसान है।", "దీన్ని తాకి వాడడం సులభం."),
  fast: t("It arrives the soonest.", "यह सबसे जल्दी पहुँचेगा।", "ఇది అందరికంటే ముందు చేరుతుంది."),
  good_choice: t("A solid choice.", "एक भरोसेमंद चुनाव।", "నమ్మదగిన ఎంపిక."),
};

export const PAYMENT_NAME: Record<Payment, L3> = {
  cod: t("cash on delivery", "डिलीवरी पर नकद", "డెలివరీ సమయంలో నగదు"),
  online: t("online payment, demo only", "ऑनलाइन भुगतान, सिर्फ़ डेमो", "ఆన్‌లైన్ చెల్లింపు, డెమో మాత్రమే"),
};

export const LANGUAGE_WORD: Record<Lang, L3> = {
  en: t("English", "अंग्रेज़ी", "ఇంగ్లీష్"),
  hi: t("Hindi", "हिन्दी", "హిందీ"),
  te: t("Telugu", "तेलुगु", "తెలుగు"),
};

/** Sentences that depend on which language was picked. */
export function languageChangedText(newLang: Lang, replyOnly: boolean): string {
  const both: Record<Lang, string> = {
    en: "Okay, I will speak English.",
    hi: "ठीक है, अब मैं हिन्दी में बात करूँगी।",
    te: "సరే, ఇక నుండి తెలుగులో మాట్లాడతాను.",
  };
  const reply: Record<Lang, string> = {
    en: "Okay, I will reply in English.",
    hi: "ठीक है, मैं हिन्दी में जवाब दूँगी।",
    te: "సరే, తెలుగులో సమాధానం ఇస్తాను.",
  };
  return (replyOnly ? reply : both)[newLang];
}

/* ---------------- rendering ---------------- */

const SLOT = /\{([a-zA-Z0-9_]+)\}/g;

/** Slot names used by a template string, for tests. */
export function slotsOf(s: string): string[] {
  return [...s.matchAll(SLOT)].map((m) => m[1]).sort();
}

function groupIndian(n: number): string {
  return n.toLocaleString("en-IN");
}

/**
 * Fill a template. In caption mode numbers look like "₹1,299"; in speech mode they are plain digits
 * plus the word for rupees, and the speech cleaner turns the digits into words.
 */
export function render(tpl: string, vars: Record<string, Slot>, lang: Lang, mode: "caption" | "speech"): string {
  return tpl.replace(SLOT, (_m, name: string) => {
    const v = vars[name];
    if (v === undefined) throw new Error(`Missing slot {${name}} in "${tpl}"`);
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if ("money" in v) return mode === "caption" ? `₹${groupIndian(v.money)}` : `${v.money} ${rupeesWord(lang)}`;
    if ("dec" in v) return String(v.dec);
    if ("n" in v) return mode === "caption" ? groupIndian(v.n) : String(v.n);
    return mode === "caption" ? v.digits : spellDigits(v.digits, lang);
  });
}

/** Build one Line from a template id. */
export function line(id: TemplateId, vars: Record<string, Slot>, lang: Lang, extra: Partial<Line> = {}): Line {
  const tpl = T[id][lang];
  return { caption: render(tpl, vars, lang, "caption"), speech: render(tpl, vars, lang, "speech"), ...extra };
}

/** A line of text that is already in the right language (a product name, a review note). */
export function plain(text: string, extra: Partial<Line> = {}): Line {
  return { caption: text, speech: text, ...extra };
}

/** Read these digits one by one ("5 5 0 0 0") when spoken, and as they are on screen. */
export function spelled(digits: string): Slot {
  return { digits };
}

export function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const and: Record<Lang, string> = { en: "and", hi: "और", te: "మరియు" };
  return `${items.slice(0, -1).join(", ")} ${and[lang]} ${items[items.length - 1]}`;
}

export function joinOr(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const or: Record<Lang, string> = { en: "or", hi: "या", te: "లేదా" };
  return `${items.slice(0, -1).join(", ")} ${or[lang]} ${items[items.length - 1]}`;
}

export function formatDate(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LANG_TAG[lang], { weekday: "long", day: "numeric", month: "long" }).format(d);
}
