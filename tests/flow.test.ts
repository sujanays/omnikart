import { describe, expect, it } from "vitest";
import { execute } from "@/assistant/agent/executor";
import { answerFacetText, answerOption, applyFacetValue, changeFilters, continueFlow, skipCurrent } from "@/assistant/agent/flow";
import { emptyAction, type Action } from "@/assistant/agent/schema";
import { CATEGORIES } from "@/store/catalogue-types";
import { makeSnap, NOW } from "./helpers";
import { initialCtx, type CartLine, type Ctx, type Order, type Outcome, type Snapshot } from "@/assistant/agent/state";
import { handleCheckoutUtterance } from "@/assistant/agent/checkout";
import { FACETS, facetCounts, getProduct, matching, productsIn, rankScore } from "@/store/catalogue";
import { askedFacets, facetById } from "@/store/content/facets";
import { splitForSpeech, wordCount } from "@/assistant/speakable";
import { LANGS, type Lang } from "@/contract/lang";


/** A tiny stand-in for the browser: holds the state and applies each outcome the way the engine does. */
class Shopper {
  ctx: Ctx = initialCtx();
  cart: CartLine[] = [];
  orders: Order[] = [];
  said: string[] = [];
  constructor(
    public lang: Lang,
    public calm = false,
  ) {}
  snap(userText = "", rand?: () => number): Snapshot {
    return makeSnap({ lang: this.lang, inputLang: this.lang, cart: this.cart, ctx: this.ctx, orders: this.orders, calm: this.calm, now: NOW, userText }, rand);
  }
  take(out: Outcome | null): Outcome {
    expect(out).not.toBeNull();
    const o = out!;
    if (o.ctx) this.ctx = { ...this.ctx, ...o.ctx };
    if (o.cart) this.cart = o.cart;
    if (o.orders) this.orders = o.orders;
    for (const l of o.lines) {
      this.said.push(l.caption);
      // every spoken line fits the limits of the voice service
      for (const c of splitForSpeech(l.speech, this.lang)) expect(wordCount(c), `${this.lang}: ${c}`).toBeLessThanOrEqual(25);
    }
    return o;
  }
  async do(a: Partial<Action> & Pick<Action, "action">, userText = ""): Promise<Outcome> {
    return this.take((await execute({ ...emptyAction(a.action), ...a }, this.snap(userText))));
  }
  async say(text: string): Promise<Outcome> {
    return this.take((await answerFacetText(text, undefined, this.snap(text))));
  }
  get options() {
    return this.ctx.options.map((id) => getProduct(id)!);
  }
}

/** What a real person would say for one filter in the given language: something that keeps at least one product. */
function answerFor(s: Shopper): string {
  const category = s.ctx.category!;
  const facet = facetById(FACETS[category], s.ctx.asking)!;
  const counts = facetCounts(category, s.ctx.filters)[facet.id];
  const lang = s.lang;
  const ok = facet.options.filter((o) => {
    const trial = facet.id === "budget" && o.price ? { ...s.ctx.filters, price: o.price } : { ...s.ctx.filters, sel: { ...s.ctx.filters.sel, [facet.id]: [o.id] } };
    return matching(category, trial).length > 0 && (counts?.[o.id] ?? 0) > 0;
  });
  if (facet.kind === "bool") return ok.length ? { en: "yes", hi: "हाँ", te: "అవును" }[lang] : "skip";
  const o = ok[0];
  if (!o) return { en: "skip", hi: "छोड़ो", te: "వదిలేయండి" }[lang];
  if (o.numbers?.length && facet.kind !== "band") return String(o.numbers[0]);
  return o.label[lang];
}

const chunksOk = (text: string, lang: Lang) => splitForSpeech(text, lang).every((c) => wordCount(c) <= 25);

describe("the six steps, in every category and every language", () => {
  for (const lang of LANGS) {
    for (const category of CATEGORIES) {
      it(`${category} in ${lang}: ask, filters, matches, reviews, delivery, order`, async () => {
        const s = new Shopper(lang);

        // 1. the shopper says what they want
        const start = (await s.do({ action: "search", category }));
        expect(s.ctx.category).toBe(category);
        expect(s.ctx.step).toBe("filters");
        expect(start.nav).toBe(`/s?c=${category}`);
        // 2. the filters are read out and the first question is open
        expect(s.ctx.asking).toBe(askedFacets(FACETS[category])[0].id);
        expect(start.lines.length).toBeGreaterThanOrEqual(2);

        let guard = 0;
        while (s.ctx.asking && guard++ < 12) {
          const before = s.ctx.asking;
          (await s.say(answerFor(s)));
          expect(s.ctx.asking, `the question ${before} was answered`).not.toBe(before);
        }
        expect(guard).toBeLessThan(12);

        // 3. the best matches: one to three, all inside the filters, best first
        expect(s.ctx.step).toBe("matches");
        expect(s.options.length).toBeGreaterThanOrEqual(1);
        expect(s.options.length).toBeLessThanOrEqual(3);
        const allowed = new Set(matching(category, s.ctx.filters).map((p) => p.id));
        for (const p of s.options) expect(allowed.has(p.id), p.id).toBe(true);
        const scores = s.options.map(rankScore);
        expect(scores).toEqual([...scores].sort((a, b) => b - a));

        // 4. reviews, pros and cons
        (await s.do({ action: "open", pick: 1 }));
        expect(s.ctx.screen).toBe("product");
        const product = getProduct(s.ctx.productId)!;
        const rev = (await s.do({ action: "reviews" }));
        expect(s.ctx.step).toBe("reviews");
        expect(rev.lines.map((l) => l.caption).join(" ")).toMatch(String(product.reviews.length));

        // 5. delivery timeline
        const del = (await s.do({ action: "delivery_info" }));
        expect(s.ctx.step).toBe("delivery");
        expect(del.lines.length).toBeGreaterThanOrEqual(4);

        // 6. place the order, safely
        (await s.do({ action: "add_to_cart" }));
        expect(s.cart).toEqual([{ id: product.id, qty: 1 }]);
        (await s.do({ action: "checkout" }));
        expect(s.ctx.step).toBe("order");
        expect(s.ctx.checkout).toEqual({ payment: "cod", readbackDone: false });
        // not yet heard: the order must refuse
        const refused = (await handleCheckoutUtterance({ en: "yes place order", hi: "हाँ ऑर्डर करो", te: "అవును ఆర్డర్ చేయండి" }[lang], s.snap()));
        expect(refused?.orders).toBeUndefined();
        // heard to the end: now it places exactly one order
        s.ctx = { ...s.ctx, checkout: { payment: "cod", readbackDone: true } };
        const placed = (await handleCheckoutUtterance({ en: "yes place order", hi: "हाँ ऑर्डर करो", te: "అవును ఆర్డర్ చేయండి" }[lang], s.snap("", () => 0.3)));
        expect(placed?.orders?.length).toBe(1);
        expect(placed?.orders?.[0].total).toBe(product.price);
      });
    }
  }
});

describe("step 1: asking what they want", () => {
  it("without a category it asks one question and never searches", async () => {
    const s = new Shopper("en");
    const out = (await s.do({ action: "search" }));
    expect(out.lines[0].caption).toMatch(/What would you like to buy/);
    expect(out.ctx?.category).toBeUndefined();
  });
  it("names all five categories in the question", async () => {
    const text = (await new Shopper("en").do({ action: "clarify" })).lines.map((l) => l.caption).join(" ");
    for (const w of ["phones", "jeans", "pressure cookers", "earbuds", "shoes"]) expect(text).toContain(w);
  });
});

describe("step 2: reading the filters", () => {
  it("says what it found and the filters it will ask about, with a way out", async () => {
    const s = new Shopper("en");
    const first = (await s.do({ action: "search", category: "phones" })).lines[0].caption;
    expect(first).toMatch(/^Phones\. I have 12/);
    for (const w of ["budget", "brand", "battery", "storage"]) expect(first).toContain(w);
    expect(first).toMatch(/skip/i);
  });
  it("reads the options of the question being asked, with real prices", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    expect(s.said.join(" ")).toContain("under ₹10,000");
    expect(s.said.join(" ")).toContain("₹10,000 to ₹20,000");
    expect(s.said.join(" ")).toContain("above ₹20,000");
  });
  it("takes what was already said and does not ask it again", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones", max_price: 15000, keywords: "samsung" }));
    expect(s.ctx.filters.price).toEqual({ max: 14999 });
    expect(s.ctx.filters.sel.brand).toEqual(["samsung"]);
    expect(s.ctx.asking).toBe("battery");
    expect(s.ctx.queue).not.toContain("budget");
    expect(s.ctx.queue).not.toContain("brand");
  });
  it("says a typed price cap the way it was said", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "jeans", max_price: 1500 }));
    expect(s.said.join(" ")).toContain("under ₹1,500");
  });
  it("a number the shopper says for the budget sets the price filter", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    (await s.say("under fifteen thousand"));
    expect(s.ctx.filters.price).toEqual({ max: 14999 });
    expect(s.ctx.asking).toBe("brand");
  });
  it("works in Hindi: 'पंद्रह हज़ार से कम'", async () => {
    const s = new Shopper("hi");
    (await s.do({ action: "search", category: "phones" }));
    (await s.say("पंद्रह हज़ार से कम"));
    expect(s.ctx.filters.price).toEqual({ max: 14999 });
  });
  it("an answer that would leave nothing is refused and the question is asked again", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    const out = (await s.say("under 500"));
    expect(out.lines[0].caption).toMatch(/nothing|no phones|none/i);
    expect(s.ctx.asking).toBe("budget");
    expect(s.ctx.filters.price).toBeUndefined();
  });
  it("something that is not an answer returns null so the AI can have a go", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    expect((await answerFacetText("tell me a joke about elephants", undefined, s.snap()))).toBeNull();
  });
  it("outside a question there is nothing to answer", async () => {
    expect((await answerFacetText("samsung", undefined, new Shopper("en").snap()))).toBeNull();
  });
  it("the AI's set_filter goes through the same matching and moves on", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "cookers" }));
    s.take((await applyFacetValue("budget", "under 2000", s.snap())));
    expect(s.ctx.filters.price?.max).toBe(1999);
    expect(s.ctx.asking).toBe("capacity");
  });
  it("a bad set_filter asks the question again", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "cookers" }));
    const out = s.take((await applyFacetValue("budget", "blue cheese", s.snap())));
    expect(out.lines.length).toBeGreaterThan(1);
    expect(s.ctx.asking).toBe("budget");
  });
});

describe("skipping, jumping ahead, changing", () => {
  it("skip moves to the next question and keeps the filters", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "shoes" }));
    const out = s.take((await skipCurrent(s.snap())));
    expect(out.lines[0].caption).toMatch(/skipping budget/i);
    expect(s.ctx.asking).toBe("gender");
    expect(s.ctx.filters.price).toBeUndefined();
  });
  it("skipping every question shows the three best of all twelve", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "shoes" }));
    let guard = 0;
    while (s.ctx.asking && guard++ < 10) s.take((await skipCurrent(s.snap())));
    expect(s.ctx.step).toBe("matches");
    expect(s.ctx.options).toEqual(matching("shoes", s.ctx.filters).slice(0, 3).map((p) => p.id));
    expect(s.said.join(" ")).toMatch(/3 of 12|top 3|Number 1/);
  });
  it("skip_filter through the executor does the same", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "earbuds" }));
    (await s.do({ action: "skip_filter" }));
    expect(s.ctx.asking).toBe("brand");
  });
  it("show_matches jumps ahead without answering the rest", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "jeans" }));
    (await s.do({ action: "show_matches" }));
    expect(s.ctx.step).toBe("matches");
    expect(s.ctx.asking).toBeNull();
    expect(s.ctx.options.length).toBe(3);
  });
  it("show_matches with no category asks what they want", async () => {
    expect((await new Shopper("en").do({ action: "show_matches" })).lines[0].caption).toMatch(/What would you like to buy/);
  });
  it("change filters starts the questions again with nothing chosen", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones", max_price: 20000 }));
    (await s.do({ action: "show_matches" }));
    s.take((await changeFilters(s.snap())));
    expect(s.ctx.filters.price).toBeUndefined();
    expect(s.ctx.asking).toBe("budget");
    expect(s.ctx.options).toEqual([]);
  });
  it("a choice made by one-key scan or a click is the same as saying it", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    s.take((await answerOption("budget", "under", s.snap())));
    expect(s.ctx.filters.price).toEqual({ max: 9999 });
    expect(s.ctx.asking).toBe("brand");
  });
  it("a click on the sidebar while a question is open moves the flow on", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    s.ctx = { ...s.ctx, filters: { ...s.ctx.filters, price: { max: 14999 } }, asking: null };
    s.take((await continueFlow(s.snap())));
    expect(s.ctx.asking).toBe("brand");
  });
  it("going back from a product returns to the same results; from results starts over", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    (await s.do({ action: "show_matches" }));
    const filters = s.ctx.filters;
    (await s.do({ action: "open", pick: 1 }));
    const back = (await s.do({ action: "go_back" }));
    expect(back.nav).toBe("/s?c=phones");
    expect(s.ctx.screen).toBe("results");
    expect(s.ctx.filters).toEqual(filters);
    const over = (await s.do({ action: "go_back" }));
    expect(over.nav).toBe("/");
    expect(s.ctx.category).toBeNull();
    expect(s.ctx.step).toBe("ask");
  });
});

describe("step 3: the best matches", () => {
  it("each option has a different reason where it can, and prices come from the catalogue", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "earbuds" }));
    (await s.do({ action: "show_matches" }));
    const lines = s.said.filter((c) => /^Number \d/.test(c));
    expect(lines.length).toBe(3);
    for (const [i, id] of s.ctx.options.entries()) expect(lines[i]).toContain(`₹${getProduct(id)!.price.toLocaleString("en-IN")}`);
    const reasons = lines.map((l) => l.split(/\.\s+/).pop());
    expect(new Set(reasons).size).toBeGreaterThan(1);
  });
  it("says how many it left out", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    (await s.do({ action: "show_matches" }));
    expect(s.said.join(" ")).toMatch(/12 of 12 phones match\. Here are the best 3\./);
  });
  it("one match is said as one match, and the next step does not offer a second or third", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones", max_price: 15000, keywords: "samsung" }));
    (await s.say("yes")); // big battery
    (await s.do({ action: "show_matches" }));
    expect(s.options.length).toBe(1);
    expect(s.said.join(" ")).toMatch(/Only 1 of 12/);
    expect(s.said.at(-1)).toMatch(/Say first to hear more/);
  });
  it("when nothing fits it drops filters, says which, and still never invents a product", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "phones" }));
    s.ctx = { ...s.ctx, filters: { price: { max: 100 }, sel: { brand: ["samsung"] } }, asking: null, queue: [] };
    (await s.do({ action: "show_matches" }));
    expect(s.said.join(" ")).toMatch(/dropped|removed|did not match/i);
    expect(s.options.length).toBeGreaterThan(0);
    for (const p of s.options) expect(p.category).toBe("phones");
  });
  it("sets the store page to the same results", async () => {
    const s = new Shopper("en");
    (await s.do({ action: "search", category: "cookers" }));
    expect(s.ctx.screen).toBe("results");
    expect((await s.do({ action: "show_matches" })).nav).toBe("/s?c=cookers");
  });
});

describe("steps 4 and 5: reviews and delivery", () => {
  const withProduct = (id: string, lang: Lang = "en") => {
    const s = new Shopper(lang);
    const p = getProduct(id)!;
    s.ctx = { ...s.ctx, category: p.category, screen: "product", productId: id, options: [id] };
    return s;
  };
  it("access notes come first, then pros and cons with the review count", async () => {
    const s = withProduct("cooker-prestige-deluxe-5");
    const t = (await s.do({ action: "reviews" })).lines.map((l) => l.caption);
    expect(t[0]).toMatch(/3 shoppers with disabilities/);
    expect(t.findIndex((x) => /disabilities/.test(x))).toBeLessThan(t.findIndex((x) => /Based on/.test(x)));
    expect(t.some((x) => /People liked/.test(x))).toBe(true);
    expect(t.some((x) => /People did not like/.test(x))).toBe(true);
    expect(t.join(" ")).toMatch(/The verdict/);
    expect(t.at(-1)).toMatch(/delivery/i);
  });
  it("a product with no access notes still gets pros, cons and a count", async () => {
    const p = getProduct("jeans-spykar-alexa")!;
    const t = (await withProduct(p.id).do({ action: "reviews" })).lines.map((l) => l.caption);
    expect(t.some((x) => x.includes(`Based on ${p.reviews.length} written reviews`))).toBe(true);
    expect(t.join(" ")).not.toMatch(/disabilities/);
  });
  it("delivery: ships tomorrow, arrives by the date counted from the product's days, free, returns, seller", async () => {
    const p = getProduct("phone-redmi-note13")!;
    const t = (await withProduct(p.id).do({ action: "delivery_info" })).lines.map((l) => l.caption);
    expect(t[0]).toMatch(/ships on Sunday, 11 October/);
    expect(p.deliveryDays).toBe(4);
    expect(t[1]).toMatch(/12 Rose Lane, Hyderabad by Wednesday, 14 October/);
    expect(t.join(" ")).toMatch(/free/i);
    expect(t.join(" ")).toContain(`within ${p.returnDays} days`);
    expect(t.join(" ")).toContain(p.seller);
    expect(t.at(-1)).toMatch(/add to cart/i);
  });
  it("delivery with no product asks to pick one", async () => {
    expect((await new Shopper("en").do({ action: "delivery_info" })).lines[0].caption).toMatch(/pick a product first/);
  });
  it("delivery and reviews are spoken in Hindi and Telugu too, with the same date", async () => {
    for (const lang of ["hi", "te"] as Lang[]) {
      const t = (await withProduct("phone-redmi-note13", lang).do({ action: "delivery_info" })).lines.map((l) => l.caption).join(" ");
      expect(t).toContain("14");
      // the voice must be able to say every word: no Latin letters in a Hindi or Telugu delivery line
      expect(t).not.toMatch(/[A-Za-z]/);
      const r = (await withProduct("phone-redmi-note13", lang).do({ action: "reviews" }));
      expect(r.lines.length).toBeGreaterThan(3);
    }
  });
  it("every spoken line splits into chunks of 25 words or fewer in every language", async () => {
    for (const lang of LANGS) {
      for (const id of ["phone-samsung-m35", "jeans-levis-511", "shoes-nike-revolution7", "earbuds-boat-141", "cooker-hawkins-classic-3"]) {
        for (const a of ["open", "reviews", "delivery_info", "top_facts", "explain_simpler", "describe_photo", "size_help", "add_to_cart", "help"] as const) {
          const s = withProduct(id, lang);
          for (const l of (await s.do({ action: a, pick: 1 })).lines) expect(chunksOk(l.speech, lang), `${lang} ${id} ${a}`).toBe(true);
        }
      }
    }
  });
});

describe("category coverage", () => {
  it("every category's first question is askable and has options to read", async () => {
    for (const c of CATEGORIES) {
      const s = new Shopper("en");
      (await s.do({ action: "search", category: c }));
      expect(s.ctx.asking, c).toBe("budget");
      expect(productsIn(c).length).toBe(12);
    }
  });
});
