import type { Lang } from "@/contract/lang";
import type { CartLine, ProductDTO } from "@/contract";
import type { Action } from "@/assistant/agent/schema";
import {
  applyFacetValue,
  applyKeywords,
  askLines,
  categoryOf,
  changeFilters,
  clarify,
  filtersSummary,
  showMatches,
  skipCurrent,
  startFlow,
} from "@/assistant/agent/flow";
import { deliveryLines } from "@/assistant/agent/delivery";
import { findCategory } from "@/assistant/agent/keyword";
import { T, formatDate, joinList, line, plain, spelled, type Line } from "@/assistant/agent/templates";
import { loadCart, readbackLines, totalOf } from "@/assistant/agent/checkout";
import { cartLinesCount, type Outcome, type Snapshot } from "@/assistant/agent/state";
import { emptyFilters, facetById } from "@/assistant/content/facets";

/**
 * Plain code that turns one validated Action into spoken lines and state changes.
 * No LLM in here. Everything about products comes from the store through snap.store, and every
 * price, rating, date and total is read from that data or added up here.
 */

const CARD_TITLE: Record<"price" | "delivery" | "rating", Record<Lang, string>> = {
  price: { en: "Price", hi: "कीमत", te: "ధర" },
  delivery: { en: "Delivery", hi: "डिलीवरी", te: "డెలివరీ" },
  rating: { en: "Rating", hi: "रेटिंग", te: "రేటింగ్" },
};
const DAYS_WORD: Record<Lang, string> = { en: "days", hi: "दिन", te: "రోజులు" };

const nameOf = (p: ProductDTO, lang: Lang) => p.name[lang];
const productUrl = (snap: Snapshot, id: string) => snap.meta.urls.product.replace("{id}", encodeURIComponent(id));

async function resolveProduct(pick: number | null, snap: Snapshot): Promise<ProductDTO | undefined> {
  const { options, productId } = snap.ctx;
  const id = pick && options[pick - 1] ? options[pick - 1] : productId ? productId : options.length === 1 ? options[0] : null;
  return id ? ((await snap.store.getProduct(id)) ?? undefined) : undefined;
}

/* ---------------- search: step 1 and 2 of the journey ---------------- */

async function doSearch(a: Action, snap: Snapshot): Promise<Outcome> {
  const known = (id: string | null) => (id && categoryOf(snap, id) ? id : null);
  const category = known(a.category) ?? findCategory((a.keywords ?? "").toLowerCase(), snap.meta.categories);
  if (category) return startFlow(category, { maxPrice: a.max_price, minRating: a.min_rating, keywords: a.keywords, sort: a.sort }, snap);

  // no new category: the shopper is refining what they were already looking at
  const ctx = snap.ctx;
  if (ctx.category && (a.max_price || a.min_rating || a.keywords)) {
    const filters = { ...ctx.filters, sel: { ...ctx.filters.sel } };
    if (a.max_price) filters.price = { max: a.max_price };
    if (a.min_rating) filters.rating = a.min_rating;
    if (a.keywords) await applyKeywords(snap, ctx.category, a.keywords, filters);
    return showMatches(snap, { ...ctx, filters, queue: [], asking: null });
  }
  return { lines: [clarify(snap)] };
}

/* ---------------- product ---------------- */

function doOpen(p: ProductDTO, snap: Snapshot): Outcome {
  const lang = snap.lang;
  const card = (step: number, kind: "price" | "delivery" | "rating", value: string): Partial<Line> =>
    snap.calm ? { card: { step, of: 3, title: CARD_TITLE[kind][lang], value } } : {};
  const lines: Line[] = [
    line("product_head", { name: nameOf(p, lang), price: { money: p.price } }, lang, card(1, "price", `₹${p.price.toLocaleString("en-IN")}`)),
    line("product_delivery", { days: p.deliveryDays }, lang, card(2, "delivery", `${p.deliveryDays} ${DAYS_WORD[lang]}`)),
    line("product_rating", { rating: { dec: p.rating }, count: { n: p.ratingCount } }, lang, card(3, "rating", `${p.rating} / 5`)),
  ];
  if (p.stock <= 10) lines.push(line("product_low_stock", { stock: p.stock }, lang));
  if (p.access.length) lines.push(line("product_access_hint", {}, lang));
  lines.push(line("product_hint", {}, lang));
  return {
    lines,
    ctx: { screen: "product", productId: p.id, checkout: null, step: "reviews", asking: null },
    nav: p.url,
    log: [`Opened ${p.id}; price, rating and delivery read from the store, not from the AI`],
  };
}

function doTopFacts(p: ProductDTO, snap: Snapshot): Outcome {
  const lang = snap.lang;
  const facts = p.topFacts[lang];
  return {
    lines: [line("top_facts_intro", { name: nameOf(p, lang) }, lang), { caption: facts.join("\n"), speech: facts.join(". ") + "." }],
    ctx: { screen: "product", productId: p.id },
    nav: p.url,
  };
}

function doSimple(p: ProductDTO | undefined, snap: Snapshot): Outcome {
  const lang = snap.lang;
  if (!p) return { lines: [line("simple_need_product", {}, lang)] };
  const facts = p.simpleFacts[lang];
  if (facts.length === 0) return { lines: [line("simple_none", {}, lang)] };
  return {
    lines: [line("simple_intro", {}, lang), { caption: facts.join("\n"), speech: facts.join(". ") + "." }],
    ctx: { screen: "product", productId: p.id },
    nav: p.url,
  };
}

/** Step 4: access notes first, then liked, did not like, verdict. */
function doReviews(p: ProductDTO, snap: Snapshot): Outcome {
  const lang = snap.lang;
  const lines: Line[] = [];
  if (p.access.length) {
    lines.push(line("access_intro", { n: p.access.length }, lang));
    for (const note of p.access.slice(0, 2)) lines.push(line("access_note", { by: note.by[lang], text: note.text[lang] }, lang));
  }
  const s = p.reviewSummary;
  const pros = s.pros[lang];
  const cons = s.cons[lang];
  lines.push(line("reviews_head", { n: s.count, rating: { dec: s.average } }, lang));
  if (pros.length) lines.push(line("reviews_liked", { list: joinList(pros, lang) }, lang));
  lines.push(cons.length ? line("reviews_disliked", { list: joinList(cons, lang) }, lang) : line("reviews_no_complaints", {}, lang));
  lines.push(line(s.verdict === "happy" ? "verdict_happy" : s.verdict === "mostly" ? "verdict_mostly" : "verdict_mixed", {}, lang));
  lines.push(line("reviews_next", {}, lang));
  return {
    lines,
    ctx: { screen: "product", productId: p.id, step: "reviews" },
    nav: p.url,
    log: [`Reviews: ${s.count} written reviews summarised by the store; access notes read first`],
  };
}

/** Step 5: when it ships, when it arrives, what it costs to send, how to send it back. */
function doDelivery(p: ProductDTO, snap: Snapshot): Outcome {
  return {
    lines: deliveryLines(p, snap.lang, snap.now, snap.meta),
    ctx: { screen: "product", productId: p.id, step: "delivery" },
    nav: p.url,
    log: [`Delivery dates counted from today with ${p.deliveryDays} delivery days from the store`],
  };
}

function doPhoto(p: ProductDTO, snap: Snapshot): Outcome {
  const lang = snap.lang;
  return {
    lines: [line("photo_catalogue", { look: p.look[lang] }, lang)],
    ctx: { screen: "product", productId: p.id },
    nav: p.url,
  };
}

/** "size 9", "waist 32" or just a number. */
export function parseSizeRequest(text: string): number | null {
  const m = normalizeNumber(text).match(/\b(\d{1,2})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 3 && n <= 44 ? n : null;
}
const normalizeNumber = (s: string) => s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966)).replace(/[౦-౯]/g, (c) => String(c.charCodeAt(0) - 0x0c66));

function doSize(p: ProductDTO, snap: Snapshot): Outcome {
  const lang = snap.lang;
  const sizes = p.sizes;
  if (!sizes) return { lines: [line("size_none", {}, lang)] };
  const want = parseSizeRequest(snap.userText);
  const list = sizes.join(", ");
  const lines: Line[] =
    want === null
      ? [line("size_available", { list }, lang)]
      : sizes.includes(want)
        ? [line("size_yes", { size: want }, lang)]
        : [line("size_no", { size: want, list }, lang)];
  return { lines, ctx: { screen: "product", productId: p.id }, nav: p.url };
}

async function doCompare(a: Action, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const { options, productId } = snap.ctx;
  const get = async (id: string | undefined) => (id ? ((await snap.store.getProduct(id)) ?? undefined) : undefined);
  let pa: ProductDTO | undefined;
  let pb: ProductDTO | undefined;
  if (a.pick && a.pick2) {
    pa = await get(options[a.pick - 1]);
    pb = await get(options[a.pick2 - 1]);
  } else if (a.pick) {
    pa = await get(options[a.pick - 1]);
    pb = productId && productId !== pa?.id ? await get(productId) : await get(options.find((id) => id !== pa?.id));
  } else if (productId && options.length) {
    pa = await get(productId);
    pb = await get(options.find((id) => id !== productId));
  } else {
    pa = await get(options[0]);
    pb = await get(options[1]);
  }
  if (!pa || !pb || pa.id === pb.id) return { lines: [line("compare_need_two", {}, lang)] };

  const lines: Line[] = [
    line("compare_head", { a: nameOf(pa, lang), b: nameOf(pb, lang) }, lang),
    line("compare_line", { name: nameOf(pa, lang), price: { money: pa.price }, rating: { dec: pa.rating } }, lang),
    line("compare_line", { name: nameOf(pb, lang), price: { money: pb.price }, rating: { dec: pb.rating } }, lang),
  ];
  const diff = (await snap.store.compare(pa.id, pb.id)).difference;
  if (diff) {
    lines.push(line("compare_diff", { label: diff.label[lang], a: nameOf(pa, lang), va: diff.a[lang], b: nameOf(pb, lang), vb: diff.b[lang] }, lang));
  } else {
    lines.push(line("compare_diff_price", { a: nameOf(pa, lang), pa: { money: pa.price }, b: nameOf(pb, lang), pb: { money: pb.price } }, lang));
  }
  return { lines, log: [`Compared ${pa.id} with ${pb.id}`] };
}

/* ---------------- cart ---------------- */

function withQty(cart: CartLine[], id: string, qty: number): CartLine[] {
  const rest = cart.filter((l) => l.id !== id);
  return qty > 0 ? [...rest, { id, qty }] : rest;
}

async function doAdd(p: ProductDTO, a: Action, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const have = snap.cart.find((l) => l.id === p.id)?.qty ?? 0;
  const want = a.quantity ?? 1;
  const lines: Line[] = [];
  if (have + want > p.stock) lines.push(line("product_low_stock", { stock: p.stock }, lang));
  // the store keeps the cart and cuts anything above stock
  const cart = await snap.store.setCart(withQty(snap.cart, p.id, Math.min(have + want, p.stock)));
  const total = totalOf(await loadCart(snap, cart));
  lines.push(line("cart_added", { name: nameOf(p, lang), count: cartLinesCount(cart), total: { money: total } }, lang));
  lines.push(line("cart_added_hint", {}, lang));
  return {
    lines,
    cart,
    ctx: { screen: "product", productId: p.id },
    nav: p.url,
    log: [`Cart total ${total} added up by code from the store's prices`],
  };
}

async function doRemove(a: Action, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  let p = await resolveProduct(a.pick, snap);
  if (!p && snap.cart.length === 1) p = (await snap.store.getProduct(snap.cart[0].id)) ?? undefined;
  if (!p) return { lines: [line("need_product", {}, lang)] };
  if (!snap.cart.some((l) => l.id === p!.id)) return { lines: [line("cart_not_in", {}, lang)] };
  const cart = await snap.store.setCart(withQty(snap.cart, p.id, 0));
  return { lines: [line("cart_removed", { name: nameOf(p, lang), count: cartLinesCount(cart) }, lang)], cart };
}

async function doReadCart(snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const nav = snap.meta.urls.cart;
  if (snap.cart.length === 0) return { lines: [line("cart_empty", {}, lang)], ctx: { screen: "cart" }, nav };
  const items = await loadCart(snap, snap.cart);
  const lines: Line[] = [line("cart_head", { count: cartLinesCount(snap.cart) }, lang)];
  for (const i of items) lines.push(line("cart_line", { qty: i.qty, name: nameOf(i.p, lang), price: { money: i.p.price } }, lang));
  lines.push(line("cart_total", { total: { money: totalOf(items) } }, lang));
  lines.push(line("cart_added_hint", {}, lang));
  return { lines, ctx: { screen: "cart" }, nav };
}

/** Step 6. */
async function doCheckout(a: Action, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  if (snap.cart.length === 0) return { lines: [line("checkout_empty", {}, lang)] };
  const payment = a.payment ?? snap.ctx.checkout?.payment ?? "cod";
  const items = await loadCart(snap, snap.cart);
  return {
    lines: readbackLines(items, payment, lang, snap.now, snap.meta),
    ctx: { screen: "checkout", checkout: { payment, readbackDone: false }, step: "order", asking: null },
    nav: snap.meta.urls.checkout,
    log: ["Checkout read-back started. The order needs the spoken phrase or the labelled button, after the read-back finishes"],
  };
}

/* ---------------- orders ---------------- */

function doTrack(snap: Snapshot): Outcome {
  const lang = snap.lang;
  const o = snap.orders[0];
  if (!o) return { lines: [line("track_none", {}, lang)] };
  const when = formatDate(new Date(o.placedAt + o.deliveryDays * 86_400_000), lang);
  return {
    lines: [line("track_line", { digits: spelled(o.id), status: T[o.status === "return" ? "status_return" : "status_packed"][lang], date: when }, lang)],
    nav: snap.meta.urls.orders,
  };
}

async function doReturn(snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const o = snap.orders[0];
  if (!o) return { lines: [line("track_none", {}, lang)] };
  const updated = await snap.store.returnItem(o.id);
  if (!updated) return { lines: [line("track_none", {}, lang)] };
  return {
    lines: [line("return_done", { digits: spelled(o.id) }, lang)],
    orders: snap.orders.map((x) => (x.id === o.id ? updated : x)),
    nav: snap.meta.urls.orders,
  };
}

/* ---------------- navigation ---------------- */

export function screenPath(snap: Snapshot): string {
  const { screen, productId, category } = snap.ctx;
  const u = snap.meta.urls;
  if (screen === "product" && productId) return productUrl(snap, productId);
  if (screen === "results" && category) return categoryOf(snap, category)?.url ?? u.home;
  if (screen === "cart") return u.cart;
  if (screen === "checkout") return u.checkout;
  if (screen === "ordered") return u.orders;
  return u.home;
}

async function doWhere(snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const { screen, productId, options, category } = snap.ctx;
  const lines: Line[] = [];
  const p = productId ? await snap.store.getProduct(productId) : null;
  if (screen === "product" && p) lines.push(line("where_product", { name: nameOf(p, lang) }, lang));
  else if (screen === "cart") lines.push(line("where_cart", { count: cartLinesCount(snap.cart) }, lang));
  else if (screen === "checkout") {
    const total = totalOf(await loadCart(snap, snap.cart));
    lines.push(line("where_checkout", { count: cartLinesCount(snap.cart), total: { money: total } }, lang));
  } else if (screen === "ordered") lines.push(line("where_ordered", {}, lang));
  else if (screen === "results" && category) {
    lines.push(line("where_results", { what: categoryOf(snap, category)?.name[lang] ?? category }, lang));
    lines.push(...filtersSummary(snap));
    if (options.length) lines.push(line("where_options", { n: options.length }, lang));
  } else {
    lines.push(line("where_home", {}, lang));
    if (options.length) lines.push(line("where_options", { n: options.length }, lang));
  }
  return { lines };
}

function backToResults(snap: Snapshot): Outcome {
  const lang = snap.lang;
  const { category } = snap.ctx;
  if (!category) return { lines: [line("going_back", {}, lang)], ctx: { screen: "home", productId: null, checkout: null }, nav: snap.meta.urls.home };
  return {
    lines: [line("going_back", {}, lang)],
    ctx: { screen: "results", productId: null, checkout: null, step: "matches" },
    nav: categoryOf(snap, category)?.url ?? snap.meta.urls.home,
  };
}

function doBack(snap: Snapshot): Outcome {
  const lang = snap.lang;
  const { screen } = snap.ctx;
  if (screen === "checkout") return { lines: [line("going_back", {}, lang)], ctx: { screen: "cart", checkout: null }, nav: snap.meta.urls.cart };
  if (screen === "product" || screen === "cart") return backToResults(snap);
  if (screen === "ordered" || screen === "results") return doStartOver(snap);
  return { lines: [line("start_over", {}, lang)], ctx: { options: [], productId: null }, nav: snap.meta.urls.home };
}

export function doStartOver(snap: Snapshot): Outcome {
  return {
    lines: [line("start_over", {}, snap.lang)],
    ctx: { screen: "home", options: [], productId: null, checkout: null, category: null, filters: emptyFilters(), queue: [], asking: null, step: "ask" },
    nav: snap.meta.urls.home,
  };
}

/* ---------------- entry point ---------------- */

export async function execute(a: Action, snap: Snapshot): Promise<Outcome> {
  const lang = snap.lang;
  const needProduct = { lines: [line("need_product", {}, lang)] };
  switch (a.action) {
    case "search":
      return doSearch(a, snap);
    case "set_filter":
      return applyFacetValue(a.facet, a.value, snap);
    case "skip_filter":
      return (await skipCurrent(snap)) ?? (snap.ctx.category ? showMatches(snap) : { lines: [clarify(snap)] });
    case "change_filters":
      return changeFilters(snap);
    case "show_matches":
      return showMatches(snap);
    case "open": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doOpen(p, snap) : needProduct;
    }
    case "top_facts": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doTopFacts(p, snap) : needProduct;
    }
    case "explain_simpler":
      return doSimple(await resolveProduct(a.pick, snap), snap);
    case "reviews": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doReviews(p, snap) : needProduct;
    }
    case "delivery_info": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doDelivery(p, snap) : needProduct;
    }
    case "describe_photo": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doPhoto(p, snap) : needProduct;
    }
    case "size_help": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doSize(p, snap) : needProduct;
    }
    case "compare":
      return doCompare(a, snap);
    case "add_to_cart": {
      const p = await resolveProduct(a.pick, snap);
      return p ? doAdd(p, a, snap) : needProduct;
    }
    case "remove_from_cart":
      return doRemove(a, snap);
    case "read_cart":
      return doReadCart(snap);
    case "checkout":
      return doCheckout(a, snap);
    case "track_order":
      return doTrack(snap);
    case "return_order":
      return doReturn(snap);
    case "ask_product": {
      const p = await resolveProduct(a.pick, snap);
      if (!p) return { lines: [line("ask_need_product", {}, lang)] };
      return { lines: [], ask: { productId: p.id, question: a.question ?? snap.userText } };
    }
    case "repeat":
      return { lines: [], repeat: true };
    case "go_back":
      return doBack(snap);
    case "where_am_i":
      return doWhere(snap);
    case "help":
      return { lines: [line("help", { example: snap.meta.categories[0]?.name[lang] ?? "" }, lang)] };
    case "clarify": {
      const { ctx } = snap;
      const facet = ctx.category ? facetById(categoryOf(snap, ctx.category)?.facets ?? [], ctx.asking) : undefined;
      if (facet && ctx.category) return { lines: [line("filter_unclear", {}, lang), ...askLines(facet, lang)] };
      return { lines: [clarify(snap)] };
    }
    case "out_of_scope":
      return { lines: [line("out_of_scope", {}, lang)], log: ["Out of scope: no medical, legal or financial advice"] };
  }
}

/** Lines for an answer to a product question. `answer` is already in the reply language. */
export function answerLines(answer: string): Line[] {
  return [plain(answer)];
}

/** How many products fit the filters now. */
export async function matchCount(snap: Snapshot): Promise<number> {
  return snap.ctx.category ? (await snap.store.search({ category: snap.ctx.category, filters: snap.ctx.filters })).items.length : 0;
}
