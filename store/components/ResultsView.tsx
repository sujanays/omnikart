"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category, Sort } from "@/contract";
import { CATEGORIES } from "@/store/catalogue-types";
import { reportPage } from "@/store/client/StoreBridge";
import { FACETS, facetCounts, matching, searchText, sortProducts } from "@/store/catalogue";
import { CATEGORY_NAME } from "@/store/content/dictionary";
import { activeBudgetOption, describeFilters, type Filters } from "@/store/content/facets";
import { emptyFilters } from "@/store/client/filters";
import { useShop } from "@/store/client/useStore";
import { ui } from "@/store/ui-text";
import type { Product } from "@/store/catalogue-types";
import { Badges, DeliveryBy, PriceBlock, Stars } from "@/store/components/parts";

type SortKey = "featured" | "low" | "high" | "rating";

function sortList(list: Product[], key: SortKey): Product[] {
  if (key === "low") return sortProducts(list, "price_low" as Sort);
  if (key === "high") return list.slice().sort((a, b) => b.price - a.price);
  if (key === "rating") return sortProducts(list, "rating" as Sort);
  return sortProducts(list);
}

/** The filter sidebar. Its check boxes and Omnikart's spoken questions are the same filters. */
function FilterSidebar({ category, filters }: { category: Category; filters: Filters }) {
  const shop = useShop();
  const { lang } = shop;
  const facets = FACETS[category];
  const counts = facetCounts(category, filters);
  const budgetOn = activeBudgetOption(facets, filters);
  return (
    <aside className="s-side s-box" aria-label={ui("filtersHeading", lang)}>
      <div className="s-bar" style={{ marginBottom: 0 }}>
        <h2>{ui("filtersHeading", lang)}</h2>
        <button type="button" className="s-btn plain" onClick={() => shop.clearFilters(category)}>
          {ui("clearAll", lang)}
        </button>
      </div>

      <div className="s-facet">
        <h3>{ui("ratingFilter", lang)}</h3>
        <ul>
          {[4, 3].map((n) => (
            <li key={n}>
              <label className="s-check">
                <input type="checkbox" checked={filters.rating === n} onChange={() => shop.setRating(category, filters.rating === n ? undefined : n)} />
                <span>{ui("starsUp", lang, { n })}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {facets.map((f) => (
        <div key={f.id} id={`facet-${f.id}`} className="s-facet s-reading" data-reading-label={ui("omnikartReading", lang)}>
          <h3>{f.title[lang]}</h3>
          <ul>
            {f.options.map((o) => {
              const checked = f.id === "budget" ? budgetOn === o.id : (filters.sel[f.id] ?? []).includes(o.id);
              const n = counts[f.id]?.[o.id] ?? 0;
              return (
                <li key={o.id}>
                  <label className="s-check">
                    <input type="checkbox" checked={checked} disabled={n === 0 && !checked} onChange={() => shop.toggleFilter(category, f.id, o.id)} />
                    <span>
                      {f.kind === "bool" ? o.label[lang] : o.label[lang]} <span className="count">({n})</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function ResultRow({ p }: { p: Product }) {
  const shop = useShop();
  const { lang } = shop;
  return (
    <li id={`product-${p.id}`} className="s-box s-resrow s-picked s-reading" data-reading-label={ui("omnikartReading", lang)} style={{ listStyle: "none" }}>
      <Link href={`/product/${p.id}`} aria-hidden="true" tabIndex={-1}>
        <Image src={p.photo} alt="" width={176} height={176} unoptimized />
      </Link>
      <div>
        <h2>
          <Link href={`/product/${p.id}`}>{p.name[lang]}</Link>
        </h2>
        <p className="s-rating">
          <Stars rating={p.rating} lang={lang} /> <span>{p.rating}</span> <Link href={`/product/${p.id}#reviews`}>({p.ratingCount.toLocaleString("en-IN")})</Link>
        </p>
        <p style={{ margin: "0.2rem 0" }}>
          <Badges p={p} lang={lang} />
        </p>
        <PriceBlock p={p} lang={lang} />
        <DeliveryBy days={p.deliveryDays} lang={lang} />
        <p style={{ margin: "0.5rem 0 0" }}>
          <button type="button" className="s-btn" onClick={() => shop.addToCart(p.id)}>
            {ui("addToCart", lang)}
            <span className="sr-only">: {p.name[lang]}</span>
          </button>
        </p>
      </div>
    </li>
  );
}

export function ResultsView() {
  const params = useSearchParams();
  const shop = useShop();
  const { lang } = shop;
  const [sort, setSort] = useState<SortKey>("featured");

  const c = params.get("c");
  const category = (CATEGORIES as readonly string[]).includes(c ?? "") ? (c as Category) : null;
  const k = params.get("k") ?? "";
  // the first paint after arriving in a new category must not use the previous category's filters
  const filters = category && shop.filtersCategory === category ? shop.filters : emptyFilters();

  // a word typed in the search bar narrows the category it was typed in
  const wanted = category && k ? new Set(searchText(k, category).map((p) => p.id)) : null;
  const inCategory = category ? matching(category, filters).filter((p) => !wanted || wanted.size === 0 || wanted.has(p.id)) : null;
  const results = inCategory ? sortList(inCategory, sort) : sortList(searchText(k), sort);
  const idsKey = results.map((p) => p.id).join(",");
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    reportPage({ kind: "results", category: category ?? undefined, productIds: idsKey ? idsKey.split(",") : [], filters: JSON.parse(filtersKey) as Filters });
  }, [category, idsKey, filtersKey]);
  const total = category ? matching(category, emptyFilters()).length : 0;
  const what = category ? CATEGORY_NAME[category][lang] : `“${k}”`;
  const chips = category ? describeFilters(filters, FACETS[category], lang) : [];

  return (
    <div className="s-page">
      <div className="s-results">
        {category ? <FilterSidebar category={category} filters={filters} /> : <div />}
        <section aria-labelledby="results-title">
          <div className="s-bar">
            <h1 id="results-title">{ui("resultsFor", lang, { n: results.length, what })}</h1>
            <div>
              <label htmlFor="sort">{ui("sortBy", lang)} </label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="featured">{ui("sortFeatured", lang)}</option>
                <option value="low">{ui("sortPriceLow", lang)}</option>
                <option value="high">{ui("sortPriceHigh", lang)}</option>
                <option value="rating">{ui("sortRating", lang)}</option>
              </select>
            </div>
          </div>
          {chips.length > 0 && (
            <div className="s-chips" role="group" aria-label={ui("yourFilters", lang)}>
              {chips.map((t) => (
                <span key={t} className="s-chip">
                  {t}
                </span>
              ))}
              <span className="s-chip">
                {results.length} / {total}
              </span>
            </div>
          )}
          {results.length === 0 ? (
            <div className="s-box">
              <p>{ui("noResults", lang)}</p>
            </div>
          ) : (
            <ul style={{ padding: 0, margin: 0 }}>
              {results.map((p) => (
                <ResultRow key={p.id} p={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
