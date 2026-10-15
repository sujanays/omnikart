import type { Lang } from "@/contract/lang";
import type { Category, Filters, ProductDTO } from "@/contract";
import {
  askedFacets,
  describeFilters,
  emptyFilters,
  facetById,
  matchFacetAnswer,
  matchFacetValue,
  type Facet,
  type FacetAnswer,
} from "@/assistant/content/facets";
import { REASON, joinList, joinOr, line, type Line } from "@/assistant/agent/templates";
import type { Ctx, Outcome, Snapshot } from "@/assistant/agent/state";

/**
 * The guided journey, as plain functions. No AI. The only network is the store's own contract.
 *
 *   1 ask what they want   2 read the filters and let them choose   3 suggest the best matches
 *   4 reviews, pros and cons   5 delivery timeline   6 place the order (see checkout.ts)
 *
 * Steps 1 to 3 live here. Each function takes the current state and returns the lines to speak and
 * the changes to make. The store page shows the same `filters`, so what is said and what is ticked agree.
 * Which products fit, in what order and with what reason comes from the store (search), never from here.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The question "what would you like to buy?" with the store's own categories as examples. */
export function clarify(snap: Snapshot): Line {
  const names = snap.meta.categories.map((c) => c.name[snap.lang]);
  return line("clarify", { list: joinOr(names, snap.lang) }, snap.lang);
}

export const categoryOf = (snap: Snapshot, id: Category | null | undefined) => snap.meta.categories.find((c) => c.id === id);
const whatIs = (snap: Snapshot, c: Category) => categoryOf(snap, c)?.name[snap.lang] ?? c;
const resultsPath = (snap: Snapshot, c: Category) => categoryOf(snap, c)?.url ?? snap.meta.urls.home;
const facetOf = (snap: Snapshot, c: Category, id: string | null | undefined): Facet | undefined => facetById(categoryOf(snap, c)?.facets ?? [], id);
const facetsOf = (snap: Snapshot, c: Category): Facet[] => categoryOf(snap, c)?.facets ?? [];

/** How many products fit the filters. */
export async function matchCount(snap: Snapshot, category: Category, filters: Filters): Promise<number> {
  return (await snap.store.search({ category, filters })).items.length;
}

/** True when this facet already has an answer. */
function answered(f: Filters, facet: Facet): boolean {
  if (facet.id === "budget") return !!f.price;
  return (f.sel[facet.id]?.length ?? 0) > 0;
}

/** The question for one filter, with its options read aloud. */
export function askLines(facet: Facet, lang: Lang): Line[] {
  const focus = { focus: facet.domId };
  const q = facet.ask![lang];
  if (facet.kind === "bool") return [line("ask_bool", { question: q }, lang, focus)];
  if (facet.kind === "size") return [line("ask_plain", { question: q }, lang, focus)];
  const ids = facet.askOptions ?? facet.options.map((o) => o.id);
  const labels = ids.map((id) => facet.options.find((o) => o.id === id)!.label[lang]);
  const lines = [line("ask_options", { question: q, options: joinOr(labels, lang) }, lang, focus)];
  if (ids.length < facet.options.length) lines.push(line("ask_other", {}, lang));
  return lines;
}

/** Ask the next unanswered filter, or show the matches if there is none left. */
async function next(snap: Snapshot, ctx: Ctx, before: Line[]): Promise<Outcome> {
  const lang = snap.lang;
  const category = ctx.category!;
  const queue = ctx.queue.slice();
  while (queue.length) {
    const facet = facetOf(snap, category, queue[0]);
    if (facet && !answered(ctx.filters, facet)) {
      queue.shift();
      return {
        lines: [...before, ...askLines(facet, lang)],
        ctx: { ...ctx, queue, asking: facet.id, step: "filters", screen: "results", options: [], productId: null },
        nav: resultsPath(snap, category),
      };
    }
    queue.shift();
  }
  return showMatches(snap, { ...ctx, queue: [], asking: null }, before);
}

/**
 * Start (or restart) the journey for a category. `pre` carries anything the shopper already said,
 * so Omnikart does not ask for it again.
 */
export async function startFlow(
  category: Category,
  pre: { maxPrice?: number | null; minRating?: number | null; keywords?: string | null; sort?: string | null },
  snap: Snapshot,
): Promise<Outcome> {
  const lang = snap.lang;
  const filters = emptyFilters();
  const log: string[] = [];
  if (pre.maxPrice) filters.price = { max: pre.maxPrice - 1 };
  if (pre.minRating) filters.rating = pre.minRating;
  const applied = pre.keywords ? await applyKeywords(snap, category, pre.keywords, filters) : [];
  if (applied.length) log.push(`Filters taken from what you said: ${applied.join(", ")}`);

  const facets = facetsOf(snap, category);
  const asked = askedFacets(facets).filter((f) => !answered(filters, f));
  const total = (await snap.store.search({ category, filters: emptyFilters() })).total;
  const queue = asked.map((f) => f.id);
  const ctx: Ctx = {
    ...snap.ctx,
    category,
    filters,
    queue,
    asking: null,
    step: "filters",
    introduced: true,
    screen: "results",
    options: [],
    productId: null,
    checkout: null,
  };

  const lines: Line[] = [];
  const titles = (queue.length > 0 ? asked : askedFacets(facets)).map((f) => f.title[lang]);
  lines.push(line("flow_start", { what: cap(whatIs(snap, category)), n: total, list: joinList(titles, lang) }, lang));
  const known = describeFilters(filters, facets, lang);
  if (known.length) lines.push(line("filter_set", { label: known.join(", "), n: await matchCount(snap, category, filters) }, lang));
  const out = await next(snap, ctx, lines);
  return { ...out, log: [...log, ...(out.log ?? [])] };
}

/** Words like "samsung" or "slim" in what the shopper said turn into filters. Returns what was applied. */
export async function applyKeywords(snap: Snapshot, category: Category, keywords: string, filters: Filters): Promise<string[]> {
  const cleaned = keywords.toLowerCase().replace(/noise cancel(?:l)?(?:ing|ation)/g, "cancelling");
  const applied: string[] = [];
  for (const facet of facetsOf(snap, category)) {
    if (facet.kind === "band") continue;
    const ans = matchFacetAnswer(facet, cleaned, "en");
    if (ans.kind === "options" && ans.ids.length) {
      const trial: Filters = { ...filters, sel: { ...filters.sel, [facet.id]: ans.ids } };
      if ((await matchCount(snap, category, trial)) > 0) {
        filters.sel[facet.id] = ans.ids;
        applied.push(`${facet.id}=${ans.ids.join("+")}`);
      }
    }
  }
  return applied;
}

/** Put one answer into the filters. Returns the new filters and the words for it, or null when nothing would match. */
async function applyAnswer(snap: Snapshot, facet: Facet, ans: FacetAnswer): Promise<{ filters: Filters; label: string } | null> {
  const ctx = snap.ctx;
  const category = ctx.category!;
  const lang = snap.lang;
  let filters: Filters = { ...ctx.filters, sel: { ...ctx.filters.sel } };
  let label = "";
  if (ans.kind === "price") {
    filters = { ...filters, price: ans.price };
    label = describeFilters({ price: ans.price, sel: {} }, facetsOf(snap, category), lang)[0] ?? "";
  } else if (ans.kind === "options") {
    filters.sel[facet.id] = ans.ids;
    label = joinOr(ans.ids.map((id) => facet.options.find((o) => o.id === id)!.label[lang]), lang);
    // choosing a price band sets the price filter
    const band = facet.options.find((o) => o.id === ans.ids[0])?.price;
    if (facet.id === "budget" && band) {
      delete filters.sel[facet.id];
      filters.price = band;
    }
  } else {
    return null;
  }
  return (await matchCount(snap, category, filters)) > 0 ? { filters, label } : null;
}

/** The shopper answered the question Omnikart just asked. Returns null when it was not an answer. */
export async function answerFacetText(text: string, ordinal: 1 | 2 | 3 | undefined, snap: Snapshot): Promise<Outcome | null> {
  const { ctx } = snap;
  if (!ctx.asking || !ctx.category) return null;
  const facet = facetOf(snap, ctx.category, ctx.asking);
  if (!facet) return null;
  const ans = matchFacetAnswer(facet, text, snap.inputLang, ordinal);
  if (ans.kind === "none") return null;
  return settle(snap, facet, ans);
}

/** The AI picked set_filter. Same matching, same result as the spoken path. */
export async function applyFacetValue(facetId: string | null, value: string | null, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const { ctx } = snap;
  if (!ctx.category) return { lines: [clarify(snap)] };
  const facets = facetsOf(snap, ctx.category);
  const facet = facetById(facets, facetId) ?? facets.find((f) => f.title.en.toLowerCase().includes((facetId ?? "~").toLowerCase()));
  if (!facet || !value) return { lines: [clarify(snap)] };
  const ans = matchFacetValue(facet, value, snap.inputLang);
  if (ans.kind === "none") {
    return ctx.asking ? reask(snap, [line("filter_unclear", {}, lang)]) : { lines: [line("filter_unclear", {}, lang)] };
  }
  return settle(snap, facet, ans);
}

async function settle(snap: Snapshot, facet: Facet, ans: FacetAnswer): Promise<Outcome> {
  const lang = snap.lang;
  const ctx = snap.ctx;
  const category = ctx.category!;
  if (ans.kind === "skip") {
    const lines = [line("filter_skipped", { title: facet.title[lang] }, lang)];
    return next(snap, { ...ctx, asking: ctx.asking === facet.id ? null : ctx.asking }, lines);
  }
  const applied = await applyAnswer(snap, facet, ans);
  if (!applied) {
    const label =
      ans.kind === "price"
        ? (describeFilters({ price: ans.price, sel: {} }, facetsOf(snap, category), lang)[0] ?? "")
        : joinOr((ans as { ids: string[] }).ids.map((id) => facet.options.find((o) => o.id === id)!.label[lang]), lang);
    return reask(snap, [line("filter_none", { label }, lang)]);
  }
  const n = await matchCount(snap, category, applied.filters);
  const lines = [line("filter_set", { label: applied.label, n }, lang)];
  const newCtx: Ctx = { ...ctx, filters: applied.filters, asking: ctx.asking === facet.id ? null : ctx.asking };
  return next(snap, newCtx, lines);
}

/** Ask the same question again, after saying why. */
function reask(snap: Snapshot, before: Line[]): Outcome {
  const { ctx } = snap;
  const facet = facetOf(snap, ctx.category!, ctx.asking);
  if (!facet) return { lines: before };
  return { lines: [...before, ...askLines(facet, snap.lang)], ctx: { asking: facet.id } };
}

/** "Skip" while a question is open. */
export async function skipCurrent(snap: Snapshot): Promise<Outcome | null> {
  const { ctx } = snap;
  if (!ctx.asking || !ctx.category) return null;
  const facet = facetOf(snap, ctx.category, ctx.asking);
  if (!facet) return null;
  return settle(snap, facet, { kind: "skip" });
}

/** Say the filters again from the start. */
export async function changeFilters(snap: Snapshot): Promise<Outcome> {
  const { ctx } = snap;
  if (!ctx.category) return { lines: [clarify(snap)] };
  const lang = snap.lang;
  const fresh: Ctx = { ...ctx, filters: emptyFilters(), queue: askedFacets(facetsOf(snap, ctx.category)).map((f) => f.id), asking: null, options: [], step: "filters", screen: "results", productId: null };
  return next(snap, fresh, [line("filters_restart", {}, lang)]);
}

/** Step 3: the best three, each with an honest reason, and how many were left out. */
export async function showMatches(snap: Snapshot, ctxIn: Ctx = snap.ctx, before: Line[] = []): Promise<Outcome> {
  const lang = snap.lang;
  const category = ctxIn.category;
  if (!category) return { lines: [clarify(snap)] };
  const lines: Line[] = [...before];
  // the store ranks the matches; if nothing fits it drops filters, newest first, and says which
  const res = await snap.store.search({ category, filters: ctxIn.filters, relax: true });
  const items: ProductDTO[] = res.items;
  const top = items.slice(0, 3);
  const total = res.total;
  const name = whatIs(snap, category);
  if (res.dropped.length > 0) {
    const names = res.dropped.map((d) => (d === "price" ? { en: "the budget", hi: "बजट", te: "బడ్జెట్" }[lang] : d === "rating" ? { en: "the rating", hi: "रेटिंग", te: "రేటింగ్" }[lang] : (facetOf(snap, category, d)?.title[lang] ?? d)));
    lines.push(line("matches_relaxed", { dropped: joinList(names, lang), m: items.length }, lang));
  } else {
    lines.push(items.length <= 3 ? line("matches_few", { m: items.length, total, what: name }, lang) : line("matches_head", { m: items.length, total, what: name, n: top.length }, lang));
  }
  top.forEach((p, i) => {
    lines.push(line("option", { i: i + 1, name: p.name[lang], price: { money: p.price }, reason: REASON[res.reasons[i] ?? "good_choice"][lang] }, lang, { focus: p.domId }));
  });
  lines.push(line(top.length === 1 ? "matches_next_one" : top.length === 2 ? "matches_next_two" : "matches_next", {}, lang));
  return {
    lines,
    ctx: { ...ctxIn, filters: res.filters, queue: [], asking: null, step: "matches", screen: "results", options: top.map((p) => p.id), productId: null, checkout: null },
    nav: resultsPath(snap, category),
    log: [`Matches: ${top.map((p) => p.id).join(", ")} (${items.length} of ${total} fit; prices read from the store)`],
  };
}

/** What Omnikart says about the filters now on. */
export function filtersSummary(snap: Snapshot): Line[] {
  const { ctx, lang } = snap;
  if (!ctx.category) return [clarify(snap)];
  const list = describeFilters(ctx.filters, facetsOf(snap, ctx.category), lang);
  return list.length ? [line("filters_current", { list: joinList(list, lang) }, lang)] : [];
}

/** A one-key choice picked one option of a filter. Same result as saying it. */
export async function answerOption(facetId: string, optionId: string, snap: Snapshot): Promise<Outcome> {
  const { ctx } = snap;
  if (!ctx.category) return { lines: [clarify(snap)] };
  const facet = facetOf(snap, ctx.category, facetId);
  if (!facet) return { lines: [clarify(snap)] };
  return settle(snap, facet, { kind: "options", ids: [optionId] });
}

/** The shopper answered a question by clicking in the page's filters: move on to the next question or the matches. */
export async function continueFlow(snap: Snapshot): Promise<Outcome> {
  if (!snap.ctx.category) return { lines: [clarify(snap)] };
  return next(snap, { ...snap.ctx, asking: null }, []);
}
