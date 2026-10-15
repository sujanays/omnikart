/**
 * Brand names written in Devanagari and Telugu, so a Hindi or Telugu voice can say them.
 * Brand names are used for a realistic demo only. Models, specifications, prices and reviews are illustrative.
 * To be read once by a native speaker.
 */
export const BRAND_SCRIPT: Record<string, { hi: string; te: string }> = {
  Samsung: { hi: "सैमसंग", te: "శాంసంగ్" },
  Redmi: { hi: "रेडमी", te: "రెడ్మీ" },
  realme: { hi: "रियलमी", te: "రియల్‌మీ" },
  OnePlus: { hi: "वनप्लस", te: "వన్‌ప్లస్" },
  Vivo: { hi: "वीवो", te: "వివో" },
  Motorola: { hi: "मोटोरोला", te: "మోటోరోలా" },
  iQOO: { hi: "आईक्यूओओ", te: "ఐక్యూ" },
  "Levi's": { hi: "लिवाइस", te: "లెవీస్" },
  "Pepe Jeans": { hi: "पेपे जींस", te: "పెపే జీన్స్" },
  Lee: { hi: "ली", te: "లీ" },
  Wrangler: { hi: "रैंगलर", te: "రాంగ్లర్" },
  "Flying Machine": { hi: "फ़्लाइंग मशीन", te: "ఫ్లయింగ్ మెషిన్" },
  Spykar: { hi: "स्पाइकर", te: "స్పైకర్" },
  "Jack & Jones": { hi: "जैक एंड जोन्स", te: "జాక్ అండ్ జోన్స్" },
  Roadster: { hi: "रोडस्टर", te: "రోడ్‌స్టర్" },
  "U.S. Polo Assn.": { hi: "यू एस पोलो", te: "యు ఎస్ పోలో" },
  Killer: { hi: "किलर", te: "కిల్లర్" },
  Prestige: { hi: "प्रेस्टीज", te: "ప్రెస్టీజ్" },
  Hawkins: { hi: "हॉकिन्स", te: "హాకిన్స్" },
  Pigeon: { hi: "पिजन", te: "పిజియన్" },
  Butterfly: { hi: "बटरफ्लाई", te: "బటర్‌ఫ్లై" },
  Wonderchef: { hi: "वंडरशेफ़", te: "వండర్‌చెఫ్" },
  Bajaj: { hi: "बजाज", te: "బజాజ్" },
  Vinod: { hi: "विनोद", te: "వినోద్" },
  Milton: { hi: "मिल्टन", te: "మిల్టన్" },
  boAt: { hi: "बोट", te: "బోట్" },
  Noise: { hi: "नॉइज़", te: "నాయిస్" },
  Sony: { hi: "सोनी", te: "సోనీ" },
  JBL: { hi: "जेबीएल", te: "జేబీఎల్" },
  Apple: { hi: "ऐप्पल", te: "ఆపిల్" },
  Boult: { hi: "बोल्ट", te: "బోల్ట్" },
  Nike: { hi: "नाइकी", te: "నైకీ" },
  Adidas: { hi: "एडिडास", te: "అడిడాస్" },
  Puma: { hi: "पूमा", te: "పూమా" },
  Skechers: { hi: "स्केचर्स", te: "స్కెచర్స్" },
  Bata: { hi: "बाटा", te: "బాటా" },
  Campus: { hi: "कैंपस", te: "క్యాంపస్" },
  Woodland: { hi: "वुडलैंड", te: "వుడ్‌ల్యాండ్" },
  "Red Tape": { hi: "रेड टेप", te: "రెడ్ టేప్" },
  Liberty: { hi: "लिबर्टी", te: "లిబర్టీ" },
  Sparx: { hi: "स्पार्क्स", te: "స్పార్క్స్" },
  Reebok: { hi: "रीबॉक", te: "రీబాక్" },
  Asian: { hi: "एशियन", te: "ఏషియన్" },
};

export function brandIn(brand: string, lang: "en" | "hi" | "te"): string {
  if (lang === "en") return brand;
  return BRAND_SCRIPT[brand]?.[lang] ?? brand;
}

/** The store's own seller names, written in each script so the voice can say them. Illustrative sellers for the demo. */
export const SELLER_SCRIPT: Record<string, { hi: string; te: string }> = {
  "Haat Retail": { hi: "हाट रिटेल", te: "హాట్ రిటైల్" },
  "Metro Electronics": { hi: "मेट्रो इलेक्ट्रॉनिक्स", te: "మెట్రో ఎలక్ట్రానిక్స్" },
  "BrandStore Official": { hi: "ब्रांडस्टोर ऑफ़िशियल", te: "బ్రాండ్‌స్టోర్ ఆఫీషియల్" },
  "Urban Lifestyle": { hi: "अर्बन लाइफ़स्टाइल", te: "అర్బన్ లైఫ్‌స్టైల్" },
  "Kitchen Kart India": { hi: "किचन कार्ट इंडिया", te: "కిచెన్ కార్ట్ ఇండియా" },
  "Sound Hub": { hi: "साउंड हब", te: "సౌండ్ హబ్" },
  "Shoe Plaza": { hi: "शू प्लाज़ा", te: "షూ ప్లాజా" },
};

export function sellerIn(seller: string, lang: "en" | "hi" | "te"): string {
  if (lang === "en") return seller;
  return SELLER_SCRIPT[seller]?.[lang] ?? seller;
}
