import { describe, expect, it } from "vitest";
import { createStoreService, memorySession } from "@/store/service";
import { CONTRACT_VERSION } from "@/contract";

const fresh = (rand?: () => number) => createStoreService(memorySession(), { rand, now: () => 1_700_000_000_000 });

describe("the store, on its own, through the contract", () => {
  it("describes itself: version, five categories, urls, and facets without any functions", async () => {
    const m = await fresh().meta();
    expect(m.contractVersion).toBe(CONTRACT_VERSION);
    expect(m.categories.map((c) => c.id)).toEqual(["phones", "jeans", "cookers", "earbuds", "shoes"]);
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    for (const c of m.categories) for (const f of c.facets) expect(f.domId).toBe(`facet-${f.id}`);
  });

  it("search is best first, with a reason for each of the first three, and relaxes when nothing fits", async () => {
    const s = fresh();
    const r = await s.search({ category: "phones", filters: { sel: {} } });
    expect(r.items).toHaveLength(12);
    expect(r.reasons).toHaveLength(3);
    const none = await s.search({ category: "phones", filters: { price: { max: 100 }, sel: {} } });
    expect(none.items).toHaveLength(0);
    const relaxed = await s.search({ category: "phones", filters: { price: { max: 100 }, sel: {} }, relax: true });
    expect(relaxed.items.length).toBeGreaterThan(0);
    expect(relaxed.dropped).toContain("price");
  });

  it("product data carries real numbers and per language text, never HTML", async () => {
    const p = (await fresh().getProduct("cooker-hawkins-classic-3"))!;
    expect(p.price).toBe(1475);
    expect(p.url).toBe("/product/cooker-hawkins-classic-3");
    expect(p.topFacts.hi.length).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toMatch(/<\/?[a-z]+[ >]/i);
  });

  it("the cart is cut to stock, merged by product, and unknown products are dropped", async () => {
    const s = fresh();
    const cart = await s.setCart([
      { id: "cooker-prestige-svachh-3", qty: 99 },
      { id: "cooker-prestige-svachh-3", qty: 1 },
      { id: "nope", qty: 1 },
    ]);
    expect(cart).toEqual([{ id: "cooker-prestige-svachh-3", qty: 8 }]);
  });

  it("an order needs a confirmation and a cart, and takes the cart", async () => {
    const s = fresh(() => 0.5);
    await s.setCart([{ id: "earbuds-boat-141", qty: 2 }]);
    // @ts-expect-error a caller that sends no confirmation at all
    expect(await s.checkout({ payment: "cod" })).toEqual({ ok: false, reason: "no_confirmation" });
    expect(await s.getCart()).toHaveLength(1);
    const res = await s.checkout({ payment: "cod", confirmation: { method: "voice", phrase: "yes place order" } });
    expect(res).toMatchObject({ ok: true, order: { id: "55000", total: 1998, payment: "cod", status: "packed" } });
    expect(await s.getCart()).toEqual([]);
    expect(await s.checkout({ payment: "cod", confirmation: { method: "button" } })).toEqual({ ok: false, reason: "empty_cart" });
  });

  it("tracks and returns an order; an unknown order is null", async () => {
    const s = fresh(() => 0.1);
    await s.setCart([{ id: "earbuds-boat-141", qty: 1 }]);
    const r = await s.checkout({ payment: "online", confirmation: { method: "button" } });
    const id = r.ok ? r.order.id : "";
    expect((await s.track(id))?.status).toBe("packed");
    expect((await s.returnItem(id))?.status).toBe("return");
    expect((await s.getOrders())[0].status).toBe("return");
    expect(await s.track("00000")).toBeNull();
    expect(await s.returnItem("00000")).toBeNull();
  });
});
