import raw from "@/store/data/products.json";
import derivedRaw from "@/store/data/derived.json";
import { CATEGORIES, type Derived, type Product } from "@/store/catalogue-types";
import type { Category, Sort } from "@/contract";
import { buildFacets, matchesFilters, type Facet, type Filters } from "@/store/content/facets";

/** The catalogue is the only source of prices, ratings, stock and delivery days. */
export const PRODUCTS = raw as unknown as Product[];
export const DERIVED = derivedRaw as unknown as Derived;

export function getProduct(id: string | null | undefined): Product | undefined {
  return id ? PRODUCTS.find((p) => p.id === id) : undefined;
}

export function productsIn(category: Category): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

/** Every filter of every category, built once from the catalogue. */
export const FACETS: Record<Category, Facet[]> = Object.fromEntries(CATEGORIES.map((c) => [c, buildFacets(c, PRODUCTS)])) as Record<Category, Facet[]>;

/* ------------------------------------------------------------------ *
 * Matching and ranking
 * ------------------------------------------------------------------ */

/** How good a product looks overall: rating first, then how many people rated it, badges and discount. */
export function rankScore(p: Product): number {
  const discount = p.mrp > 0 ? ((p.mrp - p.price) / p.mrp) * 100 : 0;
  return p.rating * 20 + Math.log10(p.ratingCount + 1) * 8 + (p.bestSeller ? 5 : 0) + (p.choice ? 4 : 0) + discount * 0.15;
}

export function sortProducts(list: Product[], sort: Sort | null = null): Product[] {
  return list.slice().sort((a, b) => {
    if (sort === "price_low") return a.price - b.price;
    if (sort === "rating") return b.rating - a.rating || b.ratingCount - a.ratingCount;
    if (sort === "popular") return b.ratingCount - a.ratingCount;
    return rankScore(b) - rankScore(a) || a.price - b.price;
  });
}

/** Every product in the category that passes the filters, best first. */
export function matching(category: Category, filters: Filters, sort: Sort | null = null): Product[] {
  const facets = FACETS[category];
  return sortProducts(productsIn(category).filter((p) => matchesFilters(p, filters, facets)), sort);
}

/**
 * How many products each option would give if chosen, with every OTHER filter kept.
 * This is what the sidebar shows next to each check box, and what lets Omnikart say "3 of 12".
 */
export function facetCounts(category: Category, filters: Filters): Record<string, Record<string, number>> {
  const facets = FACETS[category];
  const mine = productsIn(category);
  const out: Record<string, Record<string, number>> = {};
  for (const f of facets) {
    out[f.id] = {};
    for (const o of f.options) {
      out[f.id][o.id] = mine.filter((p) => matchesFilters(p, filters, facets, f.id) && o.test(p)).length;
    }
  }
  return out;
}

/** Nothing matched: drop filters, newest first, until something does. Says what was dropped. */
export function relaxFilters(category: Category, filters: Filters): { filters: Filters; dropped: string[] } {
  const f: Filters = { ...filters, sel: { ...filters.sel } };
  const dropped: string[] = [];
  const order: string[] = [];
  if (f.rating !== undefined) order.push("rating");
  order.push(...Object.keys(f.sel).filter((k) => f.sel[k]?.length).reverse());
  if (f.price) order.push("price");
  for (const key of order) {
    if (matching(category, f).length > 0) break;
    if (key === "rating") delete f.rating;
    else if (key === "price") delete f.price;
    else delete f.sel[key];
    dropped.push(key);
  }
  return { filters: f, dropped };
}

export type Reason = "cheapest" | "top_rated" | "best_seller" | "touch" | "fast" | "good_choice";

/** One honest reason per option, no two options sharing a reason when it can be avoided. */
export function assignReasons(items: Product[]): Reason[] {
  const used = new Set<Reason>();
  return items.map((p) => {
    const cand: Reason[] = [];
    if (items.length > 1 && p.price === Math.min(...items.map((x) => x.price)) && items.filter((x) => x.price === p.price).length === 1) cand.push("cheapest");
    if (items.length > 1 && p.rating === Math.max(...items.map((x) => x.rating)) && items.filter((x) => x.rating === p.rating).length === 1) cand.push("top_rated");
    if (p.bestSeller) cand.push("best_seller");
    if (p.touchFriendly) cand.push("touch");
    if (items.length > 1 && p.deliveryDays === Math.min(...items.map((x) => x.deliveryDays)) && items.filter((x) => x.deliveryDays === p.deliveryDays).length === 1) cand.push("fast");
    const pick = cand.find((r) => !used.has(r)) ?? "good_choice";
    if (pick !== "good_choice") used.add(pick);
    return pick;
  });
}

/* ------------------------------------------------------------------ *
 * Text search (the store's search bar)
 * ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Products whose brand, model, title or keywords contain every word typed. */
export function searchText(query: string, category?: Category | null): Product[] {
  const words = norm(query).filter((w) => !["the", "a", "for", "and", "with", "buy", "best"].includes(w));
  if (words.length === 0) return category ? productsIn(category) : [];
  const pool = category ? productsIn(category) : PRODUCTS;
  return sortProducts(
    pool.filter((p) => {
      const hay = new Set(norm(`${p.brand} ${p.model} ${p.name.en} ${p.keywords.join(" ")}`));
      return words.every((w) => hay.has(w) || [...hay].some((h) => h.startsWith(w) && w.length >= 3));
    }),
  );
}

/* ------------------------------------------------------------------ *
 * Dates and money
 * ------------------------------------------------------------------ */

/** Delivery date as a Date, from today plus the product's delivery days. */
export function deliveryDate(days: number, from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function cartTotal(lines: { id: string; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + (getProduct(l.id)?.price ?? 0) * l.qty, 0);
}

export function maxDeliveryDays(lines: { id: string; qty: number }[]): number {
  return lines.reduce((m, l) => Math.max(m, getProduct(l.id)?.deliveryDays ?? 0), 0);
}
