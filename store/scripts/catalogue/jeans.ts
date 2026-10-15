import { BLIND, MOTOR, OLDER, type Seed } from "@/store/scripts/catalogue/common";

const SELLER = ["Urban Lifestyle", "BrandStore Official", "Haat Retail"];
const mk = (
  id: string,
  brand: string,
  model: string,
  price: number,
  mrp: number,
  ratingCount: number,
  q: number,
  gender: "men" | "women",
  fit: "slim" | "regular" | "relaxed",
  colour: string,
  stretch: boolean,
  sizes: number[],
  extra: Partial<Seed> = {},
): Seed => ({
  id,
  brand,
  model,
  price,
  mrp,
  ratingCount,
  stock: 20 + (ratingCount % 60),
  deliveryDays: 2 + (ratingCount % 4),
  seller: SELLER[ratingCount % 3],
  returnDays: 30,
  q,
  attrs: { gender, fit, colour, stretch, sizes },
  keywords: ["jeans", "denim", "trousers", gender, fit],
  ...extra,
});

export const JEANS: Seed[] = [
  mk("jeans-levis-511", "Levi's", "511", 2799, 3999, 18420, 0.86, "men", "slim", "blue", true, [30, 32, 34, 36], {
    hero: true,
    bestSeller: true,
    choice: true,
    touch: true,
    access: [
      { by: BLIND, text: { en: "The waist size is stitched on a leather patch at the back that I can read by touch. The button and zip are easy to find.", hi: "कमर का साइज़ पीछे चमड़े के टुकड़े पर सिला है जिसे मैं छूकर पढ़ लेता हूँ। बटन और ज़िप आसानी से मिल जाते हैं।", te: "నడుము సైజ్ వెనుక తోలు ముక్కపై కుట్టి ఉంది, తాకి చదవగలను. బటన్, జిప్ సులభంగా దొరుకుతాయి." } },
      { by: MOTOR, text: { en: "The button is large and the zip pull is big enough to hold with one finger.", hi: "बटन बड़ा है और ज़िप का पुल इतना बड़ा है कि एक उँगली से पकड़ा जा सकता है।", te: "బటన్ పెద్దది, జిప్ లాగుడు ఒక్క వేలితో పట్టుకునేంత పెద్దది." } },
      { by: OLDER, text: { en: "The fabric stretches a little, so it is easy to put on while sitting down.", hi: "कपड़ा थोड़ा खिंचता है, इसलिए बैठकर पहनना आसान है।", te: "బట్ట కొద్దిగా సాగుతుంది, కాబట్టి కూర్చుని వేసుకోవడం సులభం." } },
    ],
  }),
  mk("jeans-levis-721", "Levi's", "721 High Rise", 2999, 4499, 9340, 0.84, "women", "slim", "blue", true, [26, 28, 30, 32]),
  mk("jeans-pepe-hatch", "Pepe Jeans", "Hatch", 1899, 3499, 12670, 0.78, "men", "slim", "black", true, [30, 32, 34, 36, 38]),
  mk("jeans-lee-rodeo", "Lee", "Rodeo", 1799, 3299, 15230, 0.8, "men", "regular", "darkBlue", false, [32, 34, 36, 38], { hero: true }),
  mk("jeans-wrangler-texas", "Wrangler", "Texas", 1499, 2999, 8420, 0.76, "men", "relaxed", "blue", false, [32, 34, 36, 38]),
  mk("jeans-flyingmachine-jackson", "Flying Machine", "Jackson", 1199, 2799, 11020, 0.66, "men", "slim", "grey", true, [28, 30, 32, 34]),
  mk("jeans-spykar-alexa", "Spykar", "Alexa", 1099, 2299, 7290, 0.7, "women", "slim", "black", true, [26, 28, 30, 32, 34]),
  mk("jeans-jackjones-mike", "Jack & Jones", "Mike", 2199, 3999, 5320, 0.82, "men", "relaxed", "blue", true, [30, 32, 34, 36]),
  mk("jeans-roadster-classic", "Roadster", "Classic", 799, 1999, 40120, 0.66, "men", "regular", "blue", false, [30, 32, 34, 36, 38], { hero: true, bestSeller: true }),
  mk("jeans-roadster-skinny", "Roadster", "Skinny", 849, 1999, 13500, 0.64, "women", "slim", "black", true, [26, 28, 30, 32, 34]),
  mk("jeans-uspolo-mom", "U.S. Polo Assn.", "Mom Fit", 1599, 2999, 4460, 0.74, "women", "relaxed", "blue", false, [28, 30, 32, 34]),
  mk("jeans-killer-regular", "Killer", "Regular", 699, 1799, 9180, 0.6, "men", "regular", "grey", false, [30, 32, 34, 36]),
];
