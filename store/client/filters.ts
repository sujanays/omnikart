import type { Category, Filters } from "@/contract";
import { FACETS } from "@/store/catalogue";

export const emptyFilters = (): Filters => ({ sel: {} });

/**
 * The sidebar check boxes. Turn one option on or off. Budget and size are one choice at a time;
 * everything else can have several.
 */
export function toggleOptionIn(category: Category, filters: Filters, facetId: string, optionId: string): Filters {
  const facet = FACETS[category]?.find((f) => f.id === facetId);
  const opt = facet?.options.find((o) => o.id === optionId);
  if (!facet || !opt) return filters;
  const next: Filters = { ...filters, sel: { ...filters.sel } };
  if (facet.id === "budget" && opt.price) {
    const same = filters.price?.min === opt.price.min && filters.price?.max === opt.price.max;
    if (same) delete next.price;
    else next.price = opt.price;
    return next;
  }
  const cur = next.sel[facet.id] ?? [];
  const on = cur.includes(optionId);
  const single = facet.kind === "size" || facet.kind === "bool";
  const list = on ? cur.filter((x) => x !== optionId) : single ? [optionId] : [...cur, optionId];
  if (list.length) next.sel[facet.id] = list;
  else delete next.sel[facet.id];
  return next;
}
