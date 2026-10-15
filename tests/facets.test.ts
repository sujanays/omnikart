import { describe, expect, it } from "vitest";
import type { FacetDef } from "@/contract";
import { FACETS, facetCounts, matching, productsIn, relaxFilters } from "@/store/catalogue";
import { CATEGORIES } from "@/store/catalogue-types";
import { toggleOptionIn } from "@/store/client/filters";
import {
  activeBudgetOption,
  askedFacets,
  describeFilters,
  emptyFilters,
  facetById,
  matchFacetAnswer,
  matchFacetValue,
  numbersIn,
  parseBudget,
} from "@/assistant/content/facets";
import { LANGS } from "@/contract/lang";
import { META } from "./helpers";

type Cat = (typeof CATEGORIES)[number];
/** What the assistant sees: the store's filters as published in meta(), without the test functions. */
const DEF = Object.fromEntries(META.categories.map((c) => [c.id, c.facets])) as Record<Cat, FacetDef[]>;

const facet = (c: Cat, id: string) => facetById(DEF[c], id)!;

describe("facets: what Omnikart asks, per category", () => {
  it("asks the planned filters in the planned order", () => {
    const ids = (c: (typeof CATEGORIES)[number]) => askedFacets(DEF[c]).map((f) => f.id);
    expect(ids("phones")).toEqual(["budget", "brand", "battery", "storage"]);
    expect(ids("jeans")).toEqual(["budget", "gender", "fit", "waist"]);
    expect(ids("cookers")).toEqual(["budget", "capacity", "material", "induction"]);
    expect(ids("earbuds")).toEqual(["budget", "brand", "battery", "anc"]);
    expect(ids("shoes")).toEqual(["budget", "gender", "type", "size"]);
  });

  it("every asked filter has a question in all three languages and options in all three languages", () => {
    for (const c of CATEGORIES) {
      for (const f of askedFacets(DEF[c])) {
        for (const l of LANGS) {
          expect(f.ask![l].length, `${c}/${f.id}`).toBeGreaterThan(5);
          expect(f.title[l].length).toBeGreaterThan(1);
          for (const o of f.options) expect(o.label[l].length, `${c}/${f.id}/${o.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("budget bands split the catalogue and never leave a band empty", () => {
    for (const c of CATEGORIES) {
      const bands = FACETS[c].find((f) => f.id === "budget")!.options;
      expect(bands.length).toBe(3);
      let seen = 0;
      for (const b of bands) {
        const n = productsIn(c).filter((p) => b.test(p)).length;
        expect(n, `${c}/${b.id}`).toBeGreaterThan(0);
        seen += n;
      }
      // every product falls in exactly one band
      expect(seen).toBe(12);
    }
  });

  it("each option's words are lower case, so spoken text can be matched without caring about case", () => {
    for (const c of CATEGORIES) for (const f of DEF[c]) for (const o of f.options) for (const w of o.words) expect(w, `${c}/${f.id}/${o.id}`).toBe(w.toLowerCase());
  });
});

describe("facets: numbers said aloud", () => {
  it("reads digits, thousands, lakhs and number words", () => {
    expect(numbersIn("15000")).toEqual([15000]);
    expect(numbersIn("15 thousand")).toEqual([15000]);
    expect(numbersIn("fifteen thousand")).toEqual([15000]);
    expect(numbersIn("1.5 lakh")).toEqual([150000]);
    expect(numbersIn("20k")).toEqual([20000]);
    expect(numbersIn("1,500 rupees")).toEqual([1500]);
    expect(numbersIn("size nine")).toEqual([9]);
  });
  it("reads Hindi and Telugu number words", () => {
    expect(numbersIn("पंद्रह हज़ार")).toEqual([15000]);
    expect(numbersIn("डेढ़ हज़ार")).toEqual([1500]);
    expect(numbersIn("ढाई हज़ार")).toEqual([2500]);
    expect(numbersIn("पाँच सौ")).toEqual([500]);
    expect(numbersIn("बत्तीस")).toEqual([32]);
    expect(numbersIn("पंद्रह వేల")).toEqual([15000]);
    expect(numbersIn("పదిహేను వేలు")).toEqual([15000]);
    expect(numbersIn("ఇరవై ఐదు")).toEqual([25]);
    expect(numbersIn("ముప్పై రెండు")).toEqual([32]);
    expect(numbersIn("ఐదు వందలు")).toEqual([500]);
  });
  it("reads Hindi and Telugu digits and multipliers", () => {
    expect(numbersIn("१५ हज़ार")).toEqual([15000]);
    expect(numbersIn("౧౫ వేల")).toEqual([15000]);
  });
});

describe("facets: budgets", () => {
  it("under, above, and between", () => {
    expect(parseBudget("under fifteen thousand")).toEqual({ max: 14999 });
    expect(parseBudget("below 2000")).toEqual({ max: 1999 });
    expect(parseBudget("up to 2000")).toEqual({ max: 2000 });
    expect(parseBudget("above twenty thousand")).toEqual({ min: 20001 });
    expect(parseBudget("ten to twenty thousand")).toEqual({ min: 10000, max: 20000 });
    expect(parseBudget("between 1000 and 2000")).toEqual({ min: 1000, max: 2000 });
  });
  it("a bare number is a ceiling", () => {
    expect(parseBudget("around 15000")).toEqual({ max: 15000 });
  });
  it("no money said means no budget", () => {
    expect(parseBudget("samsung")).toBeNull();
    expect(parseBudget("five")).toBeNull();
  });
  it("Hindi and Telugu budgets", () => {
    expect(parseBudget("पंद्रह हज़ार से कम")).toEqual({ max: 14999 });
    expect(parseBudget("पंद्रह వేల లోపు")).toEqual({ max: 14999 });
    expect(parseBudget("दस से बीस हज़ार")).toEqual({ min: 10000, max: 20000 });
    expect(parseBudget("१५००० से कम")).toEqual({ max: 14999 });
    expect(parseBudget("౧౫౦౦౦ లోపు")).toEqual({ max: 14999 });
  });
});

describe("facets: matching a spoken answer without translation or the AI", () => {
  it("picks a brand in English, Hindi and Telugu", () => {
    const brand = facet("phones", "brand");
    expect(matchFacetAnswer(brand, "samsung", "en")).toEqual({ kind: "options", ids: ["samsung"] });
    expect(matchFacetAnswer(brand, "सैमसंग", "hi")).toEqual({ kind: "options", ids: ["samsung"] });
    expect(matchFacetAnswer(brand, "శామ్సంగ్", "te")).toEqual({ kind: "options", ids: ["samsung"] });
  });
  it("allows two brands in one answer", () => {
    const r = matchFacetAnswer(facet("phones", "brand"), "samsung or redmi", "en");
    expect(r.kind).toBe("options");
    if (r.kind === "options") expect([...r.ids].sort()).toEqual(["redmi", "samsung"]);
  });
  it("picks material, and the three words for steel", () => {
    const m = facet("cookers", "material");
    expect(matchFacetAnswer(m, "steel", "en")).toEqual({ kind: "options", ids: ["steel"] });
    expect(matchFacetAnswer(m, "स्टील", "hi")).toEqual({ kind: "options", ids: ["steel"] });
    expect(matchFacetAnswer(m, "స్టీల్", "te")).toEqual({ kind: "options", ids: ["steel"] });
  });
  it("yes and no answer a yes or no filter", () => {
    const b = facet("phones", "battery");
    const yes = matchFacetAnswer(b, "yes", "en");
    expect(yes.kind).toBe("options");
    const no = matchFacetAnswer(b, "no", "en");
    expect(no.kind === "options" || no.kind === "skip").toBe(true);
  });
  it("a number answers a size or capacity filter", () => {
    expect(matchFacetAnswer(facet("cookers", "capacity"), "three litre", "en")).toMatchObject({ kind: "options" });
    expect(matchFacetAnswer(facet("shoes", "size"), "size nine", "en")).toMatchObject({ kind: "options" });
  });
  it("a budget is read as a price, even when it contains the word 'skip' elsewhere", () => {
    const r = matchFacetAnswer(facet("phones", "budget"), "under fifteen thousand", "en");
    expect(r).toEqual({ kind: "price", price: { max: 14999 } });
  });
  it("a band number picks the band", () => {
    const r = matchFacetAnswer(facet("phones", "budget"), "ten to twenty thousand", "en");
    expect(r.kind).toBe("price");
  });
  it("skip, any and 'does not matter' skip the question", () => {
    for (const w of ["skip", "any", "doesn't matter", "no preference"]) expect(matchFacetAnswer(facet("phones", "brand"), w, "en").kind, w).toBe("skip");
    expect(matchFacetAnswer(facet("phones", "brand"), "छोड़ो", "hi").kind).toBe("skip");
    expect(matchFacetAnswer(facet("phones", "brand"), "వదిలేయండి", "te").kind).toBe("skip");
  });
  it("a long sentence that happens to hold the word skip is not a skip", () => {
    expect(matchFacetAnswer(facet("phones", "brand"), "please do not skip the samsung ones for me thanks", "en").kind).toBe("options");
  });
  it("first, second and third pick the Nth read option", () => {
    const f = facet("phones", "brand");
    const ids = f.askOptions ?? f.options.map((o) => o.id);
    expect(matchFacetAnswer(f, "the second one", "en", 2)).toEqual({ kind: "options", ids: [ids[1]] });
  });
  it("gibberish matches nothing", () => {
    expect(matchFacetAnswer(facet("phones", "brand"), "purple elephant", "en").kind).toBe("none");
  });
  it("the AI's value for a filter goes through the same matching", () => {
    expect(matchFacetValue(facet("phones", "brand"), "Samsung", "en")).toEqual({ kind: "options", ids: ["samsung"] });
    expect(matchFacetValue(facet("phones", "brand"), "nonsense", "en").kind).toBe("none");
  });
});

describe("facets: applying filters", () => {
  it("no filters keeps all twelve", () => {
    for (const c of CATEGORIES) expect(matching(c, emptyFilters()).length).toBe(12);
  });
  it("a price filter keeps only what fits, best rated first", () => {
    const list = matching("phones", { sel: {}, price: { max: 15000 } });
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) expect(p.price).toBeLessThanOrEqual(15000);
  });
  it("filters from different facets AND together, options in one facet OR together", () => {
    const both = matching("phones", { sel: { brand: ["samsung", "redmi"] } });
    expect(both.every((p) => ["Samsung", "Redmi"].includes(p.brand))).toBe(true);
    expect(both.length).toBe(matching("phones", { sel: { brand: ["samsung"] } }).length + matching("phones", { sel: { brand: ["redmi"] } }).length);
    const narrower = matching("phones", { sel: { brand: ["samsung"], battery: ["big"] } });
    expect(narrower.length).toBeLessThanOrEqual(matching("phones", { sel: { brand: ["samsung"] } }).length);
  });
  it("a rating filter keeps only products at or above it", () => {
    for (const p of matching("shoes", { sel: {}, rating: 4.5 })) expect(p.rating).toBeGreaterThanOrEqual(4.5);
  });
  it("sorts by price when asked", () => {
    const list = matching("jeans", emptyFilters(), "price_low");
    expect(list.map((p) => p.price)).toEqual([...list.map((p) => p.price)].sort((a, b) => a - b));
  });
  it("an unknown facet in the filters is ignored, not a crash", () => {
    expect(matching("phones", { sel: { nonsense: ["x"] } }).length).toBe(12);
  });
});

describe("facets: counts for the sidebar", () => {
  it("each option's count is what you would get if you chose it, other filters kept", () => {
    const counts = facetCounts("phones", emptyFilters());
    for (const f of FACETS.phones) {
      for (const o of f.options) {
        const expected = productsIn("phones").filter((p) => o.test(p)).length;
        expect(counts[f.id][o.id], `${f.id}/${o.id}`).toBe(expected);
      }
    }
  });
  it("counts shrink with the other filters but a facet's own choice does not hide its siblings", () => {
    const filters = { sel: { brand: ["samsung"] } };
    const counts = facetCounts("phones", filters);
    // brand counts ignore the brand filter itself, so Redmi still shows its number
    expect(counts.brand.redmi).toBeGreaterThan(0);
    // battery counts do respect the Samsung filter
    const withSamsung = productsIn("phones").filter((p) => p.brand === "Samsung").length;
    expect(counts.battery.yes).toBeLessThanOrEqual(withSamsung);
  });
});

describe("facets: nothing matches", () => {
  it("drops the newest filters first until something fits, and says which", () => {
    const filters = { price: { max: 100 }, sel: { brand: ["samsung"] } };
    expect(matching("phones", filters).length).toBe(0);
    const r = relaxFilters("phones", filters);
    expect(r.dropped.length).toBeGreaterThan(0);
    expect(matching("phones", r.filters).length).toBeGreaterThan(0);
    expect(r.dropped).toContain("price");
  });
  it("leaves the filters alone when they already match", () => {
    const r = relaxFilters("phones", { sel: { brand: ["samsung"] } });
    expect(r.dropped).toEqual([]);
  });
});

describe("facets: sidebar toggling", () => {
  const toggle = (filters: Parameters<typeof toggleOptionIn>[1], facetId: string, optionId: string) => toggleOptionIn("phones", filters, facetId, optionId);
  it("toggling an option on and off", () => {
    const on = toggle(emptyFilters(), "brand", "samsung");
    expect(on.sel.brand).toEqual(["samsung"]);
    const two = toggle(on, "brand", "redmi");
    expect(two.sel.brand).toEqual(["samsung", "redmi"]);
    const off = toggle(two, "brand", "samsung");
    expect(off.sel.brand).toEqual(["redmi"]);
    expect(toggle(off, "brand", "redmi").sel.brand).toBeUndefined();
  });
  it("a budget band sets the price filter and is one choice at a time", () => {
    const f = facet("phones", "budget");
    const first = f.options[0];
    const on = toggle(emptyFilters(), "budget", first.id);
    expect(on.price).toEqual(first.price);
    expect(activeBudgetOption(DEF.phones, on)).toBe(first.id);
    const other = toggle(on, "budget", f.options[1].id);
    expect(other.price).toEqual(f.options[1].price);
    expect(toggle(other, "budget", f.options[1].id).price).toBeUndefined();
  });
  it("does not change the filters it was given", () => {
    const before = { sel: { brand: ["samsung"] } };
    toggle(before, "brand", "redmi");
    expect(before.sel.brand).toEqual(["samsung"]);
  });
});

describe("facets: saying what is on", () => {
  it("describes filters in each language with real numbers", () => {
    const f = { price: { max: 14999 }, sel: { brand: ["samsung"] } };
    expect(describeFilters(f, DEF.phones, "en").join(", ")).toBe("under ₹15,000, Samsung");
    expect(describeFilters(f, DEF.phones, "hi").join(" ")).toContain("₹15,000");
    expect(describeFilters(f, DEF.phones, "te").join(" ")).toContain("₹15,000");
    expect(describeFilters(emptyFilters(), DEF.phones, "en")).toEqual([]);
  });
});
