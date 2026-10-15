import { describe, expect, it } from "vitest";
import type { CartLine, FacetDef, Filters, Order, ProductDTO, StoreAdapter, StoreMeta } from "@/contract";
import { execute } from "@/assistant/agent/executor";
import { answerFacetText } from "@/assistant/agent/flow";
import { handleCheckoutUtterance } from "@/assistant/agent/checkout";
import { emptyAction } from "@/assistant/agent/schema";
import { initialCtx, type Ctx, type Outcome, type Snapshot } from "@/assistant/agent/state";
import { keywordAction } from "@/assistant/agent/keyword";
import { actionSystem } from "@/assistant/groq";

/**
 * Independence proof. A made-up store with a different name, address, categories, filters, ids and urls
 * implements the contract. The assistant must complete a search, filters, matches, product, delivery,
 * add to cart and a safe order with it, knowing nothing about phones, jeans or Haat.
 */

const L = (s: string) => ({ en: s, hi: s, te: s });
const L3s = (en: string[]) => ({ en, hi: en, te: en });

const COLOUR: FacetDef = {
  id: "colour",
  title: L("colour"),
  ask: L("Which colour do you want?"),
  kind: "single",
  domId: "f-colour",
  options: [
    { id: "red", label: L("red"), words: ["red"] },
    { id: "blue", label: L("blue"), words: ["blue"] },
  ],
};
const BUDGET: FacetDef = {
  id: "budget",
  title: L("budget"),
  ask: L("What is your budget?"),
  kind: "band",
  domId: "f-budget",
  options: [
    { id: "low", label: L("under ₹300"), words: [], price: { max: 299 } },
    { id: "high", label: L("₹300 or more"), words: [], price: { min: 300 } },
  ],
};

const META: StoreMeta = {
  contractVersion: "1.0",
  name: L("Mugshop"),
  address: { short: L("1 Tea Street, Pune"), full: L("1 Tea Street, Pune. Demo address.") },
  categories: [{ id: "mugs", name: L("mugs"), words: ["mug", "mugs", "cup"], url: "/m", facets: [BUDGET, COLOUR] }],
  urls: { home: "/", cart: "/basket", checkout: "/pay", orders: "/done", product: "/item/{id}" },
  payments: ["cod", "online"],
  elements: { addToCart: "add", goCheckout: "go", placeOrder: "place" },
};

const mk = (id: string, name: string, price: number, colour: string, rating: number): ProductDTO & { colour: string } => ({
  id,
  colour,
  category: "mugs",
  brand: "Acme",
  name: L(name),
  price,
  mrp: price + 100,
  rating,
  ratingCount: 500,
  stock: 5,
  deliveryDays: 3,
  seller: L("Mugs Inc"),
  returnDays: 10,
  bestSeller: false,
  choice: false,
  touchFriendly: false,
  hero: false,
  url: `/item/${id}`,
  domId: `p-${id}`,
  photo: "/x.png",
  look: L(`A ${colour} mug`),
  specs: [],
  topFacts: L3s(["Holds 300 ml"]),
  simpleFacts: L3s([]),
  access: [],
  reviewSummary: { count: 20, average: rating, verdict: "happy", pros: L3s(["keeps tea hot"]), cons: L3s([]) },
});
const PRODUCTS = [mk("m1", "Red mug", 250, "red", 4.2), mk("m2", "Blue mug", 350, "blue", 4.6), mk("m3", "Red big mug", 450, "red", 4.4)];

function stubStore(): StoreAdapter {
  let cart: CartLine[] = [];
  let orders: Order[] = [];
  const keep = (f: Filters) =>
    PRODUCTS.filter((p) => (!f.price?.max || p.price <= f.price.max) && (!f.price?.min || p.price >= f.price.min) && (!f.sel.colour?.length || f.sel.colour.includes(p.colour))).sort((a, b) => b.rating - a.rating);
  return {
    meta: async () => META,
    search: async (r) => ({ items: keep(r.filters), total: PRODUCTS.length, reasons: ["top_rated", "good_choice", "good_choice"], filters: r.filters, dropped: [] }),
    getProduct: async (id) => PRODUCTS.find((p) => p.id === id) ?? null,
    getProducts: async (ids) => PRODUCTS.filter((p) => ids.includes(p.id)),
    getReviews: async () => [],
    compare: async () => ({ difference: null }),
    getCart: async () => cart,
    setCart: async (l) => (cart = l),
    checkout: async (r) => {
      if (!r.confirmation) return { ok: false, reason: "no_confirmation" };
      if (!cart.length) return { ok: false, reason: "empty_cart" };
      const order: Order = { id: "90001", lines: cart, total: cart.reduce((n, l) => n + l.qty * PRODUCTS.find((p) => p.id === l.id)!.price, 0), payment: r.payment, placedAt: Date.now(), deliveryDays: 3, status: "packed" };
      orders = [order, ...orders];
      cart = [];
      return { ok: true, order };
    },
    getOrders: async () => orders,
    track: async (id) => orders.find((o) => o.id === id) ?? null,
    returnItem: async () => null,
  };
}

describe("the assistant with a store it has never seen", () => {
  it("runs the whole journey: ask, filters, matches, product, delivery, cart, safe order", async () => {
    const store = stubStore();
    let ctx: Ctx = initialCtx();
    let cart: CartLine[] = [];
    const snap = (userText = ""): Snapshot => ({ lang: "en", inputLang: "en", cart, ctx, orders: [], calm: false, now: new Date(2026, 9, 10, 12), userText, store, meta: META });
    const take = (o: Outcome | null): string => {
      expect(o).not.toBeNull();
      if (o!.ctx) ctx = { ...ctx, ...o!.ctx };
      if (o!.cart) cart = o!.cart;
      return o!.lines.map((l) => l.caption).join(" ");
    };

    // 1 and 2: it asks what the store sells, in the store's own words, then the store's own filters
    expect(take(await execute({ ...emptyAction("clarify") }, snap()))).toContain("mugs");
    const start = take(await execute({ ...emptyAction("search"), category: "mugs" }, snap()));
    expect(start).toMatch(/Mugs\. I have 3 to choose from/);
    expect(start).toContain("What is your budget?");
    expect(take(await answerFacetText("under 400", undefined, snap("under 400")))).toMatch(/under ₹400/);
    expect(ctx.asking).toBe("colour");
    expect(take(await answerFacetText("red", undefined, snap("red")))).toContain("Red");

    // 3: matches come from the store, in its order
    expect(ctx.step).toBe("matches");
    expect(ctx.options).toEqual(["m3", "m1"].filter((id) => id !== "m3"));

    // 4 and 5: product, reviews, delivery with the store's address
    expect(take(await execute({ ...emptyAction("open"), pick: 1 }, snap()))).toContain("Red mug");
    expect(take(await execute(emptyAction("reviews"), snap()))).toContain("keeps tea hot");
    expect(take(await execute(emptyAction("delivery_info"), snap()))).toContain("1 Tea Street, Pune");

    // 6: add, read back, and a safe order
    expect(take(await execute(emptyAction("add_to_cart"), snap()))).toContain("₹250");
    const rb = take(await execute(emptyAction("checkout"), snap()));
    expect(rb).toContain("1 Tea Street, Pune. Demo address.");
    expect(rb).toContain("The total is ₹250");
    // not heard yet: the phrase does nothing
    expect(take(await handleCheckoutUtterance("yes place order", snap()))).toMatch(/nothing is ordered/);
    ctx = { ...ctx, checkout: { payment: "cod", readbackDone: true } };
    const done = take(await handleCheckoutUtterance("yes place order", snap()));
    expect(done).toMatch(/Order number 9 0 0 0 1|90001/);
    expect(await store.getOrders()).toHaveLength(1);
    expect(await store.getCart()).toEqual([]);
  });

  it("the fallback matcher and the AI prompt learn the categories from the store", () => {
    expect(keywordAction("I want a mug under 300", { hasProduct: false, optionCount: 0 }, META.categories)).toMatchObject({ action: "search", category: "mugs", max_price: 300 });
    const prompt = actionSystem(META.categories);
    expect(prompt).toContain("mugs (mugs)");
    expect(prompt).toContain("budget, colour");
    expect(prompt).not.toMatch(/phones|jeans|cooker|shoes|earbuds/);
  });

  it("an unknown category the AI invents is asked about again, not searched", async () => {
    const out = await execute({ ...emptyAction("search"), category: "phones" }, { lang: "en", inputLang: "en", cart: [], ctx: initialCtx(), orders: [], calm: false, now: new Date(), userText: "", store: stubStore(), meta: META });
    expect(out.lines[0].caption).toContain("mugs");
    expect(out.ctx?.category).toBeUndefined();
  });
});
