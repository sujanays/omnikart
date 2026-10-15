import { describe, expect, it } from "vitest";
import { findCategory, keywordAction, spokenEnglishNumber, type KeywordState } from "@/assistant/agent/keyword";
import { META } from "./helpers";

const home: KeywordState = { hasProduct: false, optionCount: 0 };
const product: KeywordState = { hasProduct: true, optionCount: 1 };
const offered: KeywordState = { hasProduct: false, optionCount: 3 };

describe("keyword matcher: the fallback when the AI is limited or off", () => {
  it("finds each of the five categories by the words people use", () => {
    expect(findCategory("i want a smartphone", META.categories)).toBe("phones");
    expect(findCategory("show me jeans", META.categories)).toBe("jeans");
    expect(findCategory("a pressure cooker", META.categories)).toBe("cookers");
    expect(findCategory("bluetooth airpods", META.categories)).toBe("earbuds");
    expect(findCategory("running shoes", META.categories)).toBe("shoes");
    expect(findCategory("hello there", META.categories)).toBeNull();
    expect(META.categories.length).toBe(5);
  });

  it("finds categories written in Hindi and Telugu, with or without invisible joiners", () => {
    expect(findCategory("मुझे फ़ोन चाहिए", META.categories)).toBe("phones");
    expect(findCategory("जूते चाहिए", META.categories)).toBe("shoes");
    expect(findCategory("కుక్కర్ కావాలి", META.categories)).toBe("cookers");
    expect(findCategory("ఇయర్\u200cబడ్స్ కావాలి", META.categories)).toBe("earbuds");
    expect(keywordAction("ఇయర్\u200cబడ్స్ కావాలి", home, META.categories)).toMatchObject({ action: "search", category: "earbuds" });
  });

  it("a category starts the guided search, and a spoken price is kept", () => {
    expect(keywordAction("I want a phone under fifteen thousand", home, META.categories)).toMatchObject({ action: "search", category: "phones", max_price: 15000 });
    expect(keywordAction("pressure cooker under 1500 rupees", home, META.categories)).toMatchObject({ action: "search", category: "cookers", max_price: 1500 });
  });

  it("brand and feature words are carried along so the flow can use them", () => {
    const a = keywordAction("I need earbuds with noise cancelling", home, META.categories);
    expect(a.category).toBe("earbuds");
    expect(a.keywords).toContain("noise cancelling");
  });

  it("without a category it asks what they want and never guesses a search", () => {
    for (const t of ["hello", "tell me a joke", "something nice"]) expect(keywordAction(t, home, META.categories).action, t).toBe("clarify");
  });

  it("delivery questions, in three languages", () => {
    for (const t of ["when will it come", "delivery", "when will it arrive", "डिलीवरी कब होगी", "డెలివరీ ఎప్పుడు"]) expect(keywordAction(t, product, META.categories).action, t).toBe("delivery_info");
  });

  it("show matches and change filters", () => {
    expect(keywordAction("show matches", home, META.categories).action).toBe("show_matches");
    expect(keywordAction("that is enough", home, META.categories).action).toBe("show_matches");
    expect(keywordAction("change filters", home, META.categories).action).toBe("change_filters");
  });

  it("reviews, cart, checkout and the rest of the journey", () => {
    expect(keywordAction("reviews", product, META.categories).action).toBe("reviews");
    expect(keywordAction("what do people say", product, META.categories).action).toBe("reviews");
    expect(keywordAction("what is in my cart", home, META.categories).action).toBe("read_cart");
    expect(keywordAction("add to cart", product, META.categories).action).toBe("add_to_cart");
    expect(keywordAction("checkout please", home, META.categories).action).toBe("checkout");
    expect(keywordAction("track my order", home, META.categories).action).toBe("track_order");
  });

  it("the first, second and third pick the option on offer", () => {
    expect(keywordAction("the second one", offered, META.categories)).toMatchObject({ action: "open", pick: 2 });
    expect(keywordAction("reviews of the first", offered, META.categories)).toMatchObject({ action: "reviews", pick: 1 });
  });

  it("a question on a product page goes to the facts based answer", () => {
    expect(keywordAction("does it work on induction", product, META.categories).action).toBe("ask_product");
  });

  it("medical, legal and money advice is out of scope", () => {
    for (const t of ["which medicine should i take", "should i invest in shares", "i need a lawyer"]) expect(keywordAction(t, home, META.categories).action, t).toBe("out_of_scope");
  });

  it("never produces an action that places an order", () => {
    for (const t of ["yes place order", "confirm order", "buy it now", "order it"]) expect(["place_order", "confirm_order"]).not.toContain(keywordAction(t, product, META.categories).action);
  });
});

describe("spoken English numbers", () => {
  it("reads number words", () => {
    expect(spokenEnglishNumber(["fifteen", "hundred"])).toBe(1500);
    expect(spokenEnglishNumber(["two", "thousand", "five", "hundred"])).toBe(2500);
    expect(spokenEnglishNumber(["one", "lakh"])).toBe(100000);
    expect(spokenEnglishNumber(["hello"])).toBeNull();
  });
});
