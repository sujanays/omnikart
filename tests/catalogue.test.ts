import { describe, expect, it } from "vitest";
import { DERIVED, FACETS, PRODUCTS, getProduct, productsIn, searchText } from "@/store/catalogue";
import { CATEGORIES } from "@/store/catalogue-types";
import { reviewSummary } from "@/store/derive";
import { cleanForTts } from "@/assistant/speakable";
import { LANGS } from "@/contract/lang";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("catalogue: 60 products in 5 categories", () => {
  it("has 12 products in each category and 60 in all", () => {
    expect(PRODUCTS.length).toBe(60);
    for (const c of CATEGORIES) expect(productsIn(c).length).toBe(12);
  });

  it("ids are unique, titles are unique in every language", () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(60);
    for (const l of LANGS) expect(new Set(PRODUCTS.map((p) => p.name[l])).size).toBe(60);
  });

  it("each category has three hero products with 50+ reviews and one has the access notes", () => {
    for (const c of CATEGORIES) {
      const mine = productsIn(c);
      const heroes = mine.filter((p) => p.hero);
      expect(heroes.length, c).toBe(3);
      for (const h of heroes) expect(h.reviews.length, h.id).toBeGreaterThanOrEqual(50);
      for (const p of mine.filter((x) => !x.hero)) expect(p.reviews.length, p.id).toBeGreaterThanOrEqual(8);
      expect(mine.filter((p) => p.access.length > 0).length, c).toBe(1);
      expect(mine.find((p) => p.access.length > 0)!.access.length).toBe(3);
    }
  });

  it("hero reviews are mixed language", () => {
    const langs = new Set(getProduct("cooker-hawkins-classic-3")!.reviews.map((r) => r.lang));
    expect(langs).toEqual(new Set(["en", "hi", "hinglish"]));
  });

  it("price is below the MRP, stock and delivery days are sane, the seller and return days are set", () => {
    for (const p of PRODUCTS) {
      expect(p.price, p.id).toBeLessThanOrEqual(p.mrp);
      expect(p.stock, p.id).toBeGreaterThan(0);
      expect(p.deliveryDays, p.id).toBeGreaterThanOrEqual(1);
      expect(p.deliveryDays, p.id).toBeLessThanOrEqual(7);
      expect(p.seller.length, p.id).toBeGreaterThan(0);
      expect(p.returnDays, p.id).toBeGreaterThan(0);
    }
  });

  it("star histograms are percentages for 5 to 1 stars, add up to 100, and agree with the rating", () => {
    for (const p of PRODUCTS) {
      expect(p.histogram.length).toBe(5);
      expect(p.histogram.reduce((a, b) => a + b, 0), p.id).toBe(100);
      // histogram[0] is five stars
      const avg = p.histogram.reduce((s, pct, i) => s + pct * (5 - i), 0) / 100;
      expect(Math.abs(avg - p.rating), p.id).toBeLessThan(0.1);
    }
  });

  it("the rating shown is one decimal and matches the written reviews", () => {
    for (const p of PRODUCTS) {
      const avg = p.reviews.reduce((s, r) => s + r.stars, 0) / p.reviews.length;
      expect(p.rating, p.id).toBeCloseTo(Math.round(avg * 10) / 10, 5);
    }
  });

  it("every product has a specification list, a photo, three gallery pictures that exist on disk", () => {
    for (const p of PRODUCTS) {
      expect(p.specs.length, p.id).toBeGreaterThanOrEqual(5);
      expect(p.gallery.length, p.id).toBe(3);
      for (const src of [p.photo, ...p.gallery]) expect(existsSync(join(process.cwd(), "public", src.replace(/^\//, ""))), src).toBe(true);
      expect(p.look.en.length, p.id).toBeGreaterThan(20);
    }
  });

  it("every filter attribute the sidebar needs is present on every product", () => {
    for (const c of CATEGORIES) {
      for (const f of FACETS[c]) {
        for (const o of f.options) {
          // each option must be a real, usable choice: it must match at least one product in its category
          if (o.price) continue;
          expect(productsIn(c).some((p) => o.test(p)), `${c}/${f.id}/${o.id}`).toBe(true);
        }
      }
    }
  });

  it("titles read in the right script: no Latin letters in Hindi or Telugu titles", () => {
    for (const p of PRODUCTS) {
      expect(p.name.hi, p.id).not.toMatch(/[A-Za-z]/);
      expect(p.name.te, p.id).not.toMatch(/[A-Za-z]/);
    }
  });

  it("titles stay speakable once cleaned: no symbols and no digits left", () => {
    for (const p of PRODUCTS) {
      for (const l of LANGS) {
        const s = cleanForTts(p.name[l], l);
        expect(s, `${p.id} ${l}`).not.toMatch(/[&()'"%@#*_/\\<>[\]{}|~^`+=;:]/);
        expect(s, `${p.id} ${l}`).not.toMatch(/\d/);
      }
    }
  });

  it("no title repeats a word pair like '5G 5G'", () => {
    for (const p of PRODUCTS) expect(p.name.en, p.id).not.toMatch(/\b(\w+)\s+\1\b/i);
  });

  it("the hero reviews of every category give an honest summary with counts", () => {
    for (const p of PRODUCTS.filter((x) => x.hero)) {
      const s = reviewSummary(p, "en");
      expect(s.reviewCount).toBe(p.reviews.length);
      expect(s.pros.length + s.cons.length).toBeGreaterThan(0);
    }
  });

  it("derived data is keyed by real product ids", () => {
    for (const id of Object.keys(DERIVED)) expect(getProduct(id), id).toBeDefined();
  });
});

describe("catalogue: store search", () => {
  it("finds by brand, by model and by type word", () => {
    expect(searchText("boat").every((p) => p.brand === "boAt")).toBe(true);
    expect(searchText("levis jeans").length).toBeGreaterThan(0);
    expect(searchText("pressure cooker").every((p) => p.category === "cookers")).toBe(true);
  });
  it("narrows by category", () => {
    expect(searchText("", "shoes").length).toBe(12);
    expect(searchText("nike", "phones")).toEqual([]);
  });
  it("returns nothing for a blank search with no category", () => {
    expect(searchText("   ")).toEqual([]);
  });
});
