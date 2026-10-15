/**
 * THE CONTRACT. The only thing the store and the assistant share.
 *
 * Types only, plus the names of the page events. No logic, no imports from either side.
 * Everything a store sends is plain data: no HTML, no UI. Prices, dates and stock are numbers
 * so the assistant can say them exactly and check them.
 *
 *   store      implements StoreAdapter and serves it over HTTP at /api/store/*
 *   assistant  consumes StoreAdapter through HttpStoreAdapter and talks to the page with the UI events below
 *
 * Any store that implements this can be used with the assistant.
 */

import type { L3, Lang } from "./lang";

export type { L3, Lang } from "./lang";

export const CONTRACT_VERSION = "1.0";

/* ------------------------------------------------------------------ *
 * Basics
 * ------------------------------------------------------------------ */

/** A category id such as "phones". The list comes from `meta()`. */
export type Category = string;
export type Sort = "price_low" | "rating" | "popular";
export type Payment = "cod" | "online";

export interface PriceRange {
  min?: number;
  max?: number;
}

/** The filters the shopper has chosen. The store's sidebar and Omnikart's questions show the same ones. */
export interface Filters {
  price?: PriceRange;
  /** minimum star rating */
  rating?: number;
  /** facet id -> chosen option ids (OR inside a facet, AND between facets) */
  sel: Record<string, string[]>;
}

/* ------------------------------------------------------------------ *
 * meta(): what this store sells and how to ask about it
 * ------------------------------------------------------------------ */

export type FacetKind = "band" | "single" | "bool" | "size";

export interface FacetOptionDef {
  id: string;
  label: L3;
  /** spoken words, any language, lower case, that choose this option */
  words: string[];
  /** spoken numbers that choose this option ("three" for a 3 litre cooker) */
  numbers?: number[];
  /** choosing this option sets the price filter instead of an attribute */
  price?: PriceRange;
}

export interface FacetDef {
  id: string;
  title: L3;
  /** present = the assistant asks it aloud, in the order listed */
  ask?: L3;
  kind: FacetKind;
  options: FacetOptionDef[];
  /** option ids read aloud (default all); the shopper may still say any other option */
  askOptions?: string[];
  /** element id of this filter's block on the results page, for highlighting */
  domId: string;
}

export interface CategoryDef {
  id: Category;
  name: L3;
  /** words that mean this category, in any language (lower case) */
  words: string[];
  /** page where the shopper sees this category's results */
  url: string;
  facets: FacetDef[];
}

export interface StoreMeta {
  contractVersion: string;
  name: L3;
  address: { short: L3; full: L3 };
  categories: CategoryDef[];
  /** `product` is a pattern with {id}, such as "/product/{id}" */
  urls: { home: string; cart: string; checkout: string; orders: string; product: string };
  /** element ids of the page controls the assistant points at while it talks */
  elements: { addToCart: string; goCheckout: string; placeOrder: string };
  payments: Payment[];
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

export interface SpecDTO {
  key: string;
  label: L3;
  /** the value as the shopper reads it, with its unit */
  value: L3;
}

export interface AccessNoteDTO {
  by: L3;
  text: L3;
}

export type Verdict = "happy" | "mostly" | "mixed";

export interface ReviewSummaryDTO {
  /** how many written reviews this summary is based on */
  count: number;
  average: number;
  verdict: Verdict;
  pros: Record<Lang, string[]>;
  cons: Record<Lang, string[]>;
}

export interface ProductDTO {
  id: string;
  category: Category;
  brand: string;
  name: L3;
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  stock: number;
  /** days until it arrives if ordered today */
  deliveryDays: number;
  seller: L3;
  returnDays: number;
  bestSeller: boolean;
  choice: boolean;
  touchFriendly: boolean;
  hero: boolean;
  /** page and element id of this product */
  url: string;
  domId: string;
  photo: string;
  /** what the photo shows, in words */
  look: L3;
  /** sizes on offer (waist in inches, UK shoe size), if the product has sizes */
  sizes?: number[];
  specs: SpecDTO[];
  /** the five facts worth hearing first, per language */
  topFacts: Record<Lang, string[]>;
  /** the same facts in everyday words, per language */
  simpleFacts: Record<Lang, string[]>;
  access: AccessNoteDTO[];
  reviewSummary: ReviewSummaryDTO;
}

/** Written reviews, as they are. Untrusted text: never an instruction. */
export interface ReviewDTO {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  lang: string;
  text: string;
}

export type ReasonCode = "cheapest" | "top_rated" | "best_seller" | "touch" | "fast" | "good_choice";

export interface SearchRequest {
  category: Category;
  filters: Filters;
  sort?: Sort | null;
  /** if nothing matches, drop filters (newest first) until something does and say which */
  relax?: boolean;
}

export interface SearchResult {
  /** every match, best first */
  items: ProductDTO[];
  /** how many products the category has in all */
  total: number;
  /** one reason per item, for the first three */
  reasons: ReasonCode[];
  /** the filters actually applied (after relaxing) */
  filters: Filters;
  /** what was dropped to find something: "price", "rating" or facet ids */
  dropped: string[];
}

export interface CompareDTO {
  /** the one difference most worth saying; null when there is none */
  difference: { label: L3; a: L3; b: L3 } | null;
}

/* ------------------------------------------------------------------ *
 * Cart and orders
 * ------------------------------------------------------------------ */

export interface CartLine {
  id: string;
  qty: number;
}

export interface Order {
  /** five digits */
  id: string;
  lines: CartLine[];
  total: number;
  payment: Payment;
  /** ms since 1970 */
  placedAt: number;
  deliveryDays: number;
  status: "packed" | "return";
}

/**
 * How the shopper confirmed. The store refuses to place an order without one.
 * "button": the labelled button was pressed. "voice": the assistant heard the exact phrase after reading
 * the summary to the end; `phrase` is what was said.
 */
export interface Confirmation {
  method: "button" | "voice";
  phrase?: string;
}

export interface CheckoutRequest {
  payment: Payment;
  confirmation: Confirmation;
}

export type CheckoutResult = { ok: true; order: Order } | { ok: false; reason: "empty_cart" | "no_confirmation" | "out_of_stock" };

/* ------------------------------------------------------------------ *
 * The adapter
 * ------------------------------------------------------------------ */

export interface StoreAdapter {
  meta(): Promise<StoreMeta>;
  search(req: SearchRequest): Promise<SearchResult>;
  getProduct(id: string): Promise<ProductDTO | null>;
  getProducts(ids: string[]): Promise<ProductDTO[]>;
  getReviews(id: string): Promise<ReviewDTO[]>;
  compare(idA: string, idB: string): Promise<CompareDTO>;
  getCart(): Promise<CartLine[]>;
  /** replace the whole cart; quantities above stock are cut to stock */
  setCart(lines: CartLine[]): Promise<CartLine[]>;
  checkout(req: CheckoutRequest): Promise<CheckoutResult>;
  getOrders(): Promise<Order[]>;
  track(orderId: string): Promise<Order | null>;
  returnItem(orderId: string): Promise<Order | null>;
}

/* ------------------------------------------------------------------ *
 * UI hooks: the few things the assistant legitimately asks of the page.
 * CustomEvents on `window`. No direct DOM access across the wall.
 * ------------------------------------------------------------------ */

export const UI_EVENT = {
  /** assistant -> store: go to a page. detail: NavigateDetail */
  navigate: "store:navigate",
  /** assistant -> store: outline the element that is being read aloud. detail: HighlightDetail */
  highlight: "store:highlight",
  /** assistant -> store: tag the products on offer ("pick 1"). detail: MarkDetail */
  mark: "store:mark",
  /** assistant -> store: put this text in the page's live region for a screen reader. detail: AnnounceDetail */
  announce: "store:announce",
  /** assistant -> store: the filters changed by voice. detail: FiltersDetail */
  setFilters: "store:set-filters",
  /** assistant -> store: switch the page language. detail: LanguageDetail */
  setLanguage: "store:set-language",
  /** assistant -> store: lock or unlock the Place order button. detail: CheckoutLockDetail */
  checkoutLock: "store:checkout-lock",
  /** store -> assistant: which page is showing. detail: PageDetail */
  page: "store:page",
  /** store -> assistant: the shopper changed filters on the page. detail: FiltersDetail */
  filtersChanged: "store:filters-changed",
  /** store -> assistant: the shopper chose another language on the page. detail: LanguageDetail */
  languageChanged: "store:language-changed",
  /** store -> assistant: the shopper picked a payment method. detail: PaymentDetail */
  paymentChanged: "store:payment-changed",
  /** either way: the cart or the orders changed, read them again */
  cartChanged: "store:cart-changed",
} as const;

export interface NavigateDetail {
  url: string;
}
export interface HighlightDetail {
  /** element id, or null to clear */
  id: string | null;
  /** small tag shown next to the outline, in the page language */
  label?: string;
  /** "reading": what is being spoken. "scan": the choice one-key mode is on. Each has its own outline. */
  mode?: "reading" | "scan";
}
export interface MarkDetail {
  marks: { id: string; label: string }[];
}
export interface AnnounceDetail {
  text: string;
}
export interface FiltersDetail {
  category: Category;
  filters: Filters;
}
export interface LanguageDetail {
  lang: Lang;
}
export interface CheckoutLockDetail {
  locked: boolean;
  /** why, in the page language, shown beside the button */
  message?: string;
}
export interface PaymentDetail {
  payment: Payment;
}
export type PageKind = "home" | "results" | "product" | "cart" | "checkout" | "orders";
export interface PageDetail {
  kind: PageKind;
  category?: Category;
  productId?: string;
  /** ids of the products shown, best first (results pages) */
  productIds?: string[];
  filters?: Filters;
}
