import type { L3 } from "@/contract/lang";
import type { Category } from "@/contract";
import type { AspectKey, UnitKey } from "@/store/content/dictionary";

export interface Spec {
  key: string;
  /** a number (spoken with its unit) or a short phrase in three languages */
  value: number | L3;
  unit?: UnitKey;
}

export interface Review {
  id: string;
  lang: "en" | "hi" | "hinglish";
  stars: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** what this review is about; used to count pros and cons without guessing */
  aspects: { aspect: AspectKey; pol: 1 | -1 }[];
}

/** A short review by a shopper with a disability, answering things normal reviews skip. */
export interface AccessReview {
  by: L3;
  text: L3;
}

/**
 * What the filters look at. Phones: ram, storage, battery, screen, camera, fiveG, colour.
 * Jeans: gender, fit, colour, stretch, sizes (waist, inches). Cookers: capacity, material, induction, lid.
 * Earbuds: hours, anc, ipx, colour. Shoes: gender, type, closure, colour, sizes (UK).
 */
export type AttrValue = string | number | boolean | number[];

export interface Product {
  id: string;
  category: Category;
  brand: string;
  /** model name as printed on the box, English */
  model: string;
  /** the title in three languages, built from brand, type and the features that tell products apart */
  name: L3;
  price: number;
  mrp: number;
  /** average of the written reviews, one decimal */
  rating: number;
  /** how many shoppers rated it in total (display figure) */
  ratingCount: number;
  /** share of ratings for 5, 4, 3, 2, 1 stars, in percent, adding to 100 */
  histogram: [number, number, number, number, number];
  stock: number;
  deliveryDays: number;
  seller: string;
  returnDays: number;
  bestSeller: boolean;
  /** the store's "Choice" badge */
  choice: boolean;
  /** easy to use by touch (physical buttons, big targets) */
  touchFriendly: boolean;
  /** hero products have 50+ reviews; the first hero of a category also has disability notes */
  hero: boolean;
  /** English search words and synonyms */
  keywords: string[];
  attrs: Record<string, AttrValue>;
  specs: Spec[];
  /** what the photo shows, in words */
  look: L3;
  photo: string;
  gallery: string[];
  reviews: Review[];
  access: AccessReview[];
}

/** Optional overrides written by scripts/precompute.ts (LLM summaries, photo descriptions). */
export interface DerivedEntry {
  reviewSummary?: { pros: L3[]; cons: L3[]; source: "llm"; reviewCount: number };
  look?: L3;
}
export type Derived = Record<string, DerivedEntry>;

/** The categories this store sells. The assistant learns them from meta(), not from here. */
export const CATEGORIES = ["phones", "jeans", "cookers", "earbuds", "shoes"] as const;
