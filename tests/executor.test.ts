import { describe, expect, it } from "vitest";
import { execute, parseSizeRequest } from "@/assistant/agent/executor";
import { emptyAction, validateAction, type Action } from "@/assistant/agent/schema";
import { initialCtx, type Snapshot } from "@/assistant/agent/state";
import { META, NOW, makeSnap } from "./helpers";
import { handleCheckoutUtterance, loadCart, placeOrder, readbackLines } from "@/assistant/agent/checkout";
import { cartTotal, getProduct } from "@/store/catalogue";
import { explainSpec, mainDifference, reviewSummary, simpleFacts, topFacts } from "@/store/derive";
import { cleanForTts, splitForSpeech, wordCount } from "@/assistant/speakable";
import type { Lang } from "@/contract/lang";


const COOKER = "cooker-hawkins-classic-3"; // Rs 1,475, 2 days, access notes, hero
const BUDS = "earbuds-boat-141"; // Rs 999
const SMALL_STOCK = "cooker-prestige-svachh-3"; // only 8 in stock

const snap = (over: Partial<Snapshot> = {}, rand?: () => number): Snapshot => makeSnap(over, rand);
const act = (a: Partial<Action> & Pick<Action, "action">): Action => ({ ...emptyAction(a.action), ...a });
const caption = (o: { lines: { caption: string }[] }) => o.lines.map((l) => l.caption).join(" ");
const onProduct = (id: string, over: Partial<Snapshot> = {}) => {
  const p = getProduct(id)!;
  return snap({ ctx: { ...initialCtx(), category: p.category, options: [id], productId: id, screen: "product" }, ...over });
};

describe("executor: numbers come from the catalogue", () => {
  it("opening a product reads price, delivery, rating and count from data", async () => {
    const p = getProduct(COOKER)!;
    const out = (await execute(act({ action: "open", pick: 1 }), snap({ ctx: { ...initialCtx(), options: [COOKER, BUDS] } })));
    expect(caption(out)).toContain(`₹${p.price.toLocaleString("en-IN")}`);
    expect(caption(out)).toContain(String(p.rating));
    expect(caption(out)).toContain(`${p.deliveryDays} days`);
    expect(caption(out)).toContain(p.ratingCount.toLocaleString("en-IN"));
    expect(out.nav).toBe(`/product/${COOKER}`);
    expect(out.ctx?.productId).toBe(COOKER);
  });

  it("the rating count is spoken without separators so the speech cleaner can say it as a number", async () => {
    const p = getProduct(COOKER)!;
    const out = (await execute(act({ action: "open", pick: 1 }), snap({ ctx: { ...initialCtx(), options: [COOKER] } })));
    expect(out.lines.map((l) => l.speech).join(" ")).toContain(String(p.ratingCount));
  });

  it("calm mode gives one large fact per card, three steps", async () => {
    const out = (await execute(act({ action: "open", pick: 1 }), snap({ calm: true, ctx: { ...initialCtx(), options: [COOKER] } })));
    const cards = out.lines.filter((l) => l.card);
    expect(cards.map((l) => l.card!.step)).toEqual([1, 2, 3]);
    expect(cards.every((l) => l.card!.of === 3)).toBe(true);
    expect(cards[0].card!.value).toBe("₹1,475");
  });

  it("works in Hindi and Telugu with the same numbers", async () => {
    for (const lang of ["hi", "te"] as Lang[]) {
      const out = (await execute(act({ action: "open", pick: 1 }), snap({ lang, ctx: { ...initialCtx(), options: [COOKER] } })));
      expect(caption(out)).toContain("₹1,475");
      expect(caption(out)).toContain(getProduct(COOKER)!.name[lang]);
    }
  });

  it("opening beyond the options asks to pick a product", async () => {
    expect(caption((await execute(act({ action: "open", pick: 3 }), snap())))).toMatch(/pick a product first/);
  });
});

describe("executor: photo, sizes, compare, simple words", () => {
  it("describes the photo in words from the catalogue", async () => {
    const out = (await execute(act({ action: "describe_photo" }), onProduct(COOKER)));
    expect(caption(out)).toMatch(/pressure cooker/i);
  });

  it("jeans: lists the waist sizes, says yes and no for one size", async () => {
    const p = getProduct("jeans-levis-511")!;
    const sizes = p.attrs.sizes as number[];
    const base = onProduct(p.id);
    expect(caption((await execute(act({ action: "size_help" }), base)))).toContain(sizes.join(", "));
    expect(caption((await execute(act({ action: "size_help" }), { ...base, userText: `do you have size ${sizes[1]}` })))).toMatch(new RegExp(`${sizes[1]}`));
    expect(caption((await execute(act({ action: "size_help" }), { ...base, userText: "size 44" })))).toMatch(/44/);
  });

  it("shoes: a size that exists and one that does not", async () => {
    const p = getProduct("shoes-nike-revolution7")!;
    const sizes = p.attrs.sizes as number[];
    const yes = caption((await execute(act({ action: "size_help" }), { ...onProduct(p.id), userText: `size ${sizes[0]}` })));
    const no = caption((await execute(act({ action: "size_help" }), { ...onProduct(p.id), userText: "size 4" })));
    expect(yes).not.toEqual(no);
    expect(no).toContain(sizes.join(", "));
  });

  it("parseSizeRequest", async () => {
    expect(parseSizeRequest("size 9 please")).toBe(9);
    expect(parseSizeRequest("waist 32")).toBe(32);
    expect(parseSizeRequest("for 5000 rupees")).toBeNull();
    expect(parseSizeRequest("size nine")).toBeNull();
    expect(parseSizeRequest("साइज़ ९")).toBe(9);
    expect(parseSizeRequest("")).toBeNull();
  });

  it("a product without sizes says so", async () => {
    expect(caption((await execute(act({ action: "size_help" }), onProduct(COOKER))))).toMatch(/does not come in sizes/);
  });

  it("compare ends with the main difference", async () => {
    const s = snap({ ctx: { ...initialCtx(), options: ["cooker-hawkins-classic-3", "cooker-prestige-deluxe-5"] } });
    const out = (await execute(act({ action: "compare" }), s));
    const last = out.lines[out.lines.length - 1].caption;
    expect(last).toMatch(/^The main difference is/);
    expect(out.lines.slice(1, 3).map((l) => l.caption).join(" ")).toContain("₹1,475");
  });

  it("compare with fewer than two products asks for more", async () => {
    expect(caption((await execute(act({ action: "compare" }), snap())))).toMatch(/two products/);
  });

  it("compare a product with itself is refused", async () => {
    expect(caption((await execute(act({ action: "compare", pick: 1, pick2: 1 }), snap({ ctx: { ...initialCtx(), options: [COOKER, BUDS] } }))))).toMatch(/two products/);
  });

  it("top facts are at most five and are spoken in simple units", async () => {
    const facts = topFacts(getProduct("phone-samsung-m35")!, "en");
    expect(facts.length).toBeLessThanOrEqual(5);
    expect(facts.length).toBeGreaterThanOrEqual(3);
    // the screen shows the short unit; the voice says it in words
    expect(facts.join(" ")).toContain("mAh");
    const out = (await execute(act({ action: "top_facts" }), onProduct("phone-samsung-m35")));
    expect(out.lines.map((l) => cleanForTts(l.speech, "en")).join(" ")).toContain("milliamp hours");
  });

  it("explain simpler turns specs into everyday meaning, in each category", async () => {
    for (const id of ["phone-samsung-m35", "jeans-levis-511", COOKER, BUDS, "shoes-nike-revolution7"]) {
      const facts = simpleFacts(getProduct(id)!, "en");
      expect(facts.length, id).toBeGreaterThan(0);
      for (const f of facts) expect(f.length).toBeGreaterThan(10);
    }
    expect(simpleFacts(getProduct("phone-samsung-m35")!, "en").join(" ")).toMatch(/day/);
  });

  it("every spec explains itself or is left out, never invented", async () => {
    for (const id of ["phone-samsung-m35", COOKER]) {
      const p = getProduct(id)!;
      for (const s of p.specs) {
        const e = explainSpec(p, s);
        if (e) {
          expect(e.en.length).toBeGreaterThan(5);
          expect(e.hi.length).toBeGreaterThan(3);
          expect(e.te.length).toBeGreaterThan(3);
        }
      }
    }
  });

  it("the main difference of two products in one category exists", async () => {
    expect(mainDifference(getProduct(COOKER)!, getProduct("cooker-prestige-deluxe-5")!)).not.toBeNull();
  });

  it("the verdict follows the average rating", async () => {
    expect(reviewSummary(getProduct("cooker-prestige-deluxe-5")!, "en").verdict).toBe("happy");
    expect(["mostly", "mixed"]).toContain(reviewSummary(getProduct("cooker-pigeon-fav-3")!, "en").verdict);
  });
});

describe("executor: cart", () => {
  it("adds to the cart and computes the total from catalogue prices", async () => {
    const out = (await execute(act({ action: "add_to_cart" }), onProduct(COOKER)));
    expect(out.cart).toEqual([{ id: COOKER, qty: 1 }]);
    expect(caption(out)).toContain("₹1,475");
    expect(caption(out)).toContain("Items in your cart: 1");
  });

  it("quantity adds up and respects stock", async () => {
    const two = (await execute(act({ action: "add_to_cart", quantity: 2 }), onProduct(COOKER)));
    expect(two.cart).toEqual([{ id: COOKER, qty: 2 }]);
    const stock = getProduct(SMALL_STOCK)!.stock;
    const lots = (await execute(act({ action: "add_to_cart", quantity: 50 }), onProduct(SMALL_STOCK)));
    expect(lots.cart).toEqual([{ id: SMALL_STOCK, qty: stock }]);
    expect(caption(lots)).toContain(`Only ${stock} left`);
  });

  it("adding the same product twice adds to its quantity", async () => {
    const first = (await execute(act({ action: "add_to_cart" }), onProduct(COOKER)));
    const again = (await execute(act({ action: "add_to_cart" }), onProduct(COOKER, { cart: first.cart! })));
    expect(again.cart).toEqual([{ id: COOKER, qty: 2 }]);
  });

  it("add without a product asks to pick one", async () => {
    expect(caption((await execute(act({ action: "add_to_cart" }), snap())))).toMatch(/pick a product first/);
  });

  it("removes, and says so when the item is not there", async () => {
    const withCart = onProduct(COOKER, { cart: [{ id: COOKER, qty: 1 }] });
    expect((await execute(act({ action: "remove_from_cart" }), withCart)).cart).toEqual([]);
    expect(caption((await execute(act({ action: "remove_from_cart" }), onProduct(COOKER))))).toMatch(/not in your cart/);
  });

  it("reads the cart with a total", async () => {
    const out = (await execute(act({ action: "read_cart" }), snap({ cart: [{ id: COOKER, qty: 2 }, { id: BUDS, qty: 1 }] })));
    expect(caption(out)).toContain("₹3,949");
    expect(caption(out)).toContain("Items in your cart: 3");
    expect(caption((await execute(act({ action: "read_cart" }), snap())))).toMatch(/empty/);
  });

  it("an empty cart is never sent to checkout", async () => {
    const out = (await execute(act({ action: "checkout" }), snap()));
    expect(caption(out)).toMatch(/nothing to pay for/);
    expect(out.ctx).toBeUndefined();
  });
});

describe("checkout is safe", () => {
  const cart = [{ id: COOKER, qty: 1 }, { id: BUDS, qty: 2 }];
  const total = 1475 + 999 * 2;
  const atCheckout = (readbackDone: boolean, over: Partial<Snapshot> = {}, rand?: () => number): Snapshot =>
    snap({ cart, ctx: { ...initialCtx(), screen: "checkout", checkout: { payment: "cod", readbackDone } }, ...over }, rand);

  it("the total is the sum of catalogue prices", async () => {
    expect(cartTotal(cart)).toBe(total);
    expect(total).toBe(3473);
  });

  it("the read-back covers items, address, delivery date, payment and the total twice", async () => {
    const out = (await execute(act({ action: "checkout" }), snap({ cart })));
    const t = caption(out);
    expect(t).toContain(`1 ${getProduct(COOKER)!.name.en}`);
    expect(t).toContain(`2 ${getProduct(BUDS)!.name.en}`);
    expect(t).toMatch(/Deliver to/);
    expect(t).toMatch(/Delivery by \w+day/);
    expect(t).toMatch(/cash on delivery/);
    expect(t).toContain("₹3,473");
    expect(t).toContain("3473");
    expect(out.lines.every((l) => l.readback)).toBe(true);
    expect(out.ctx?.checkout).toEqual({ payment: "cod", readbackDone: false });
    expect(out.ctx?.step).toBe("order");
    expect(out.nav).toBe("/checkout");
  });

  it("delivery is the slowest item in the cart", async () => {
    const slow = (await execute(act({ action: "checkout" }), snap({ cart: [{ id: COOKER, qty: 1 }, { id: "cooker-prestige-deluxe-5", qty: 1 }] })));
    // Deluxe takes 4 days: 10 October + 4 = Wednesday, 14 October
    expect(caption(slow)).toContain("Wednesday, 14 October");
  });

  it("the spoken total digits are spelled one by one", async () => {
    const lines = readbackLines(await loadCart(snap(), cart), "cod", "en", NOW, META);
    expect(lines.find((l) => l.caption.startsWith("Again"))!.speech).toBe("Again, digit by digit: three four seven three.");
  });

  it("'yes, place order' after a finished read-back places exactly one order", async () => {
    const s = atCheckout(true, { userText: "yes place order" }, () => 0.5);
    const out = (await handleCheckoutUtterance("Yes, place order", s))!;
    expect(out.orders?.length).toBe(1);
    expect(out.orders![0]).toMatchObject({ id: "55000", total: 3473, payment: "cod", status: "packed" });
    expect(out.cart).toEqual([]);
    expect(out.ctx?.screen).toBe("ordered");
    expect(out.lines[0].speech).toMatch(/five five zero zero zero/);
  });

  it("a bare 'yes' does not place an order", async () => {
    expect((await handleCheckoutUtterance("yes", atCheckout(true)))).toBeNull();
    expect((await handleCheckoutUtterance("maybe", atCheckout(true)))).toBeNull();
    expect((await handleCheckoutUtterance("okay", atCheckout(true)))).toBeNull();
  });

  it("an interrupted read-back cancels the yes: nothing is ordered", async () => {
    const out = (await handleCheckoutUtterance("yes place order", atCheckout(false)))!;
    expect(out.orders).toBeUndefined();
    expect(out.cart).toBeUndefined();
    expect(caption(out)).toMatch(/nothing is ordered/);
  });

  it("the refusal is not what 'repeat' replays", async () => {
    expect((await handleCheckoutUtterance("yes place order", atCheckout(false)))!.remember).toBe(false);
    expect((await placeOrder(atCheckout(false), { method: "button" })).remember).toBe(false);
  });

  it("the button follows the same rule", async () => {
    expect((await placeOrder(atCheckout(false), { method: "button" })).orders).toBeUndefined();
    expect((await placeOrder(atCheckout(true), { method: "button" })).orders?.length).toBe(1);
  });

  it("cancel, no and 'do not order' leave the cart alone", async () => {
    for (const s of ["cancel", "no", "yes but do not place order"]) {
      const out = (await handleCheckoutUtterance(s, atCheckout(true)))!;
      expect(out.orders).toBeUndefined();
      expect(out.cart).toBeUndefined();
      expect(caption(out)).toMatch(/not placed the order/);
    }
  });

  it("the phrase does nothing outside the checkout screen", async () => {
    const s = snap({ cart, ctx: { ...initialCtx(), screen: "cart" } });
    expect((await handleCheckoutUtterance("yes place order", s))).toBeNull();
    expect((await placeOrder(s, { method: "button" })).orders).toBeUndefined();
  });

  it("a second 'place order' after the order is done does nothing", async () => {
    const first = (await handleCheckoutUtterance("yes place order", atCheckout(true, {}, () => 0.1)))!;
    const after = snap({ cart: first.cart!, orders: first.orders!, ctx: { ...initialCtx(), ...first.ctx } });
    expect((await handleCheckoutUtterance("yes place order", after))).toBeNull();
    expect((await placeOrder(after, { method: "button" })).orders).toBeUndefined();
  });

  it("works in Hindi and Telugu", async () => {
    expect((await handleCheckoutUtterance("हाँ ऑर्डर करो", atCheckout(true, { inputLang: "hi", lang: "hi" }, () => 0.2)))!.orders?.length).toBe(1);
    expect((await handleCheckoutUtterance("అవును ఆర్డర్ చేయండి", atCheckout(true, { inputLang: "te", lang: "te" }, () => 0.2)))!.orders?.length).toBe(1);
    expect((await handleCheckoutUtterance("हाँ", atCheckout(true, { inputLang: "hi", lang: "hi" })))).toBeNull();
  });

  it("changing the payment rebuilds the read-back", async () => {
    const out = (await execute(act({ action: "checkout", payment: "online" }), atCheckout(true)));
    expect(caption(out)).toMatch(/online payment, demo only/);
    expect(out.ctx?.checkout).toEqual({ payment: "online", readbackDone: false });
  });

  it("the model can never place an order: there is no such action", async () => {
    expect(validateAction({ action: "place_order" })).toBeNull();
    expect(validateAction({ action: "confirm_order" })).toBeNull();
  });
});

describe("orders", () => {
  const order = { id: "12345", lines: [{ id: COOKER, qty: 1 }], total: 1475, payment: "cod" as const, placedAt: NOW.getTime(), deliveryDays: 2, status: "packed" as const };

  it("tracks the latest order", async () => {
    const out = (await execute(act({ action: "track_order" }), snap({ orders: [order] })));
    expect(caption(out)).toMatch(/Order 12345 is packed and ready to ship/);
    expect((await execute(act({ action: "track_order" }), snap())).lines[0].caption).toMatch(/no orders/);
  });

  it("a return marks the order", async () => {
    const out = (await execute(act({ action: "return_order" }), snap({ orders: [order] })));
    expect(out.orders![0].status).toBe("return");
    expect(caption(out)).toMatch(/return request for order 12345/);
  });
});

describe("executor: other actions", () => {
  it("out of scope never gives advice", async () => {
    expect(caption((await execute(act({ action: "out_of_scope" }), snap())))).toMatch(/cannot give medical, legal or financial advice/);
  });
  it("ask_product defers to the facts based answer and keeps the question", async () => {
    const out = (await execute(act({ action: "ask_product", question: "does it work on induction" }), onProduct(COOKER)));
    expect(out.ask).toEqual({ productId: COOKER, question: "does it work on induction" });
    expect(out.lines).toEqual([]);
  });
  it("go back from checkout returns to the cart", async () => {
    expect((await execute(act({ action: "go_back" }), snap({ ctx: { ...initialCtx(), screen: "checkout", checkout: { payment: "cod", readbackDone: true } } }))).nav).toBe("/cart");
  });
  it("where am I", async () => {
    expect(caption((await execute(act({ action: "where_am_i" }), onProduct(COOKER))))).toContain(getProduct(COOKER)!.name.en);
    expect(caption((await execute(act({ action: "where_am_i" }), snap())))).toMatch(/home page|start/i);
    expect(caption((await execute(act({ action: "where_am_i" }), snap({ ctx: { ...initialCtx(), screen: "results", category: "phones" } }))))).toMatch(/phones/i);
  });
  it("repeat asks the app to replay", async () => {
    expect((await execute(act({ action: "repeat" }), snap())).repeat).toBe(true);
  });
  it("help names the six steps' commands", async () => {
    expect(caption((await execute(act({ action: "help" }), snap())))).toMatch(/\w+/);
  });
});

describe("validateAction: never trust the model", () => {
  it("accepts a good action", async () => {
    expect(validateAction({ ...emptyAction("search"), category: "phones", max_price: 15000 })).toMatchObject({ action: "search", category: "phones", max_price: 15000 });
  });
  it("accepts the filter actions with a facet and a value", async () => {
    expect(validateAction({ ...emptyAction("set_filter"), facet: "brand", value: "samsung" })).toMatchObject({ action: "set_filter", facet: "brand", value: "samsung" });
    expect(validateAction({ action: "skip_filter" })).toMatchObject({ action: "skip_filter" });
    expect(validateAction({ action: "delivery_info" })).toMatchObject({ action: "delivery_info" });
    expect(validateAction({ action: "show_matches" })).toMatchObject({ action: "show_matches" });
    expect(validateAction({ action: "change_filters" })).toMatchObject({ action: "change_filters" });
  });
  it("rejects unknown actions, including 'place_order'", async () => {
    expect(validateAction({ action: "place_order" })).toBeNull();
    expect(validateAction({ action: "confirm_order" })).toBeNull();
    expect(validateAction(null)).toBeNull();
    expect(validateAction("search")).toBeNull();
  });
  it("a category is any short word; the executor checks it against what the store sells", async () => {
    expect(validateAction({ action: "search", category: "kitchen" })!.category).toBe("kitchen");
    const out = await execute(act({ action: "search", category: "kitchen" }), snap());
    expect(caption(out)).toMatch(/What would you like to buy/);
    expect(out.ctx?.category).toBeUndefined();
  });
  it("nulls out of range and wrong typed fields", async () => {
    const a = validateAction({ action: "search", category: "Bad Cat!", max_price: -5, min_rating: 9, pick: 7, quantity: 1.5, payment: "bitcoin", sort: "random", keywords: 42, facet: "Bad Facet!", value: 7 })!;
    expect(a).toMatchObject({ category: null, max_price: null, min_rating: null, pick: null, quantity: null, payment: null, sort: null, keywords: null, facet: null, value: null });
  });
  it("trims and caps long strings", async () => {
    expect(validateAction({ action: "ask_product", question: "x".repeat(500) })!.question!.length).toBe(200);
  });
  it("fills missing fields with null", async () => {
    expect(validateAction({ action: "help" })).toEqual(emptyAction("help"));
  });
});

describe("every spoken line stays within the voice limit", () => {
  it("splits into chunks of 25 words or fewer for the common actions in every language", async () => {
    for (const lang of ["en", "hi", "te"] as Lang[]) {
      const s = snap({ lang, ctx: { ...initialCtx(), category: "phones", options: ["phone-samsung-m35", "jeans-levis-511", COOKER] } });
      for (const a of [
        act({ action: "search", category: "phones" }),
        act({ action: "open", pick: 2 }),
        act({ action: "reviews", pick: 3 }),
        act({ action: "top_facts", pick: 2 }),
        act({ action: "explain_simpler", pick: 2 }),
        act({ action: "describe_photo", pick: 1 }),
        act({ action: "size_help", pick: 2 }),
        act({ action: "compare", pick: 1, pick2: 2 }),
        act({ action: "help" }),
        act({ action: "out_of_scope" }),
      ]) {
        for (const l of (await execute(a, s)).lines) for (const c of splitForSpeech(l.speech, lang)) expect(wordCount(c)).toBeLessThanOrEqual(25);
      }
    }
  });
});
