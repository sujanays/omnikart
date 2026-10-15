import { BLIND, MOTOR, OLDER, type Seed } from "@/store/scripts/catalogue/common";

const SELLER = ["Kitchen Kart India", "Haat Retail", "BrandStore Official"];
const mk = (
  id: string,
  brand: string,
  model: string,
  price: number,
  mrp: number,
  ratingCount: number,
  q: number,
  capacity: number,
  material: "steel" | "aluminium" | "anodised",
  induction: boolean,
  lid: "inner" | "outer",
  warranty: number,
  extra: Partial<Seed> = {},
): Seed => ({
  id,
  brand,
  model,
  price,
  mrp,
  ratingCount,
  stock: 8 + (ratingCount % 30),
  deliveryDays: 2 + (ratingCount % 4),
  seller: SELLER[ratingCount % 3],
  returnDays: 10,
  q,
  attrs: { capacity, material, induction, lid, warranty },
  keywords: ["cooker", "pressure cooker", "kitchen", material, induction ? "induction" : "gas"],
  ...extra,
});

export const COOKERS: Seed[] = [
  mk("cooker-prestige-svachh-3", "Prestige", "Svachh Popular", 1349, 2030, 24330, 0.8, 3, "aluminium", false, "outer", 5),
  mk("cooker-prestige-deluxe-5", "Prestige", "Deluxe Plus", 2899, 4000, 17250, 0.88, 5, "steel", true, "outer", 5, {
    hero: true,
    bestSeller: true,
    choice: true,
    touch: true,
    access: [
      { by: BLIND, text: { en: "The lid lock clicks clearly, so I can tell open from locked by touch.", hi: "ढक्कन का लॉक साफ़ आवाज़ के साथ बंद होता है, इसलिए छूकर पता चल जाता है कि खुला है या बंद।", te: "మూత లాక్ స్పష్టంగా క్లిక్ అవుతుంది, కాబట్టి తెరిచి ఉందో మూసి ఉందో తాకి తెలుసుకోవచ్చు." } },
      { by: MOTOR, text: { en: "The handle is thick and the lid opens with one hand. There are no small buttons.", hi: "हैंडल मोटा है और ढक्कन एक हाथ से खुल जाता है। कोई छोटा बटन नहीं है।", te: "హ్యాండిల్ మందంగా ఉంది, మూత ఒక చేత్తో తెరవవచ్చు. చిన్న బటన్లు లేవు." } },
      { by: OLDER, text: { en: "The whistle is loud enough to hear from the next room.", hi: "सीटी की आवाज़ इतनी तेज़ है कि दूसरे कमरे से सुनाई देती है।", te: "విజిల్ శబ్దం పక్క గదిలోంచి వినిపించేంత గట్టిగా ఉంది." } },
    ],
  }),
  mk("cooker-hawkins-classic-3", "Hawkins", "Classic", 1475, 2195, 52100, 0.86, 3, "aluminium", false, "inner", 5, { hero: true, bestSeller: true, touch: true }),
  mk("cooker-hawkins-contura-3", "Hawkins", "Contura", 2050, 2925, 6420, 0.84, 3, "anodised", false, "inner", 5),
  mk("cooker-pigeon-fav-3", "Pigeon", "Favourite", 899, 1395, 21050, 0.66, 3, "aluminium", false, "outer", 2, { hero: true, touch: true }),
  mk("cooker-pigeon-ss-5", "Pigeon", "Stainless Steel", 1799, 2495, 9320, 0.72, 5, "steel", true, "outer", 2),
  mk("cooker-butterfly-cordial-5", "Butterfly", "Cordial", 1299, 1950, 8050, 0.7, 5, "aluminium", false, "outer", 2),
  mk("cooker-wonderchef-nutripot-3", "Wonderchef", "Nutri-Pot", 1599, 2499, 4220, 0.74, 3, "steel", true, "outer", 2),
  mk("cooker-bajaj-pcx-3", "Bajaj", "PCX", 949, 1350, 12360, 0.64, 3, "aluminium", false, "outer", 2),
  mk("cooker-vinod-platinum-5", "Vinod", "Platinum", 2299, 3200, 5450, 0.8, 5, "steel", true, "inner", 5),
  mk("cooker-milton-procook-2", "Milton", "Pro Cook", 1199, 1800, 3120, 0.68, 2, "anodised", false, "outer", 2),
  mk("cooker-prestige-popular-75", "Prestige", "Popular", 2299, 3030, 6770, 0.78, 7.5, "aluminium", false, "outer", 5),
];
