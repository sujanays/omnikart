import { describe, expect, it } from "vitest";
import { deliveryLines, timelineFor } from "@/assistant/agent/delivery";
import { PRODUCTS } from "@/store/catalogue";
import { toDTO } from "@/store/service";
import { META } from "./helpers";
import { LANGS } from "@/contract/lang";

const FRIDAY = new Date(2026, 9, 9, 18, 30); // Friday 9 October 2026, evening

describe("delivery timeline", () => {
  it("is ordered today, ships tomorrow, arrives after the product's own delivery days", () => {
    const t = timelineFor({ deliveryDays: 4 }, FRIDAY);
    expect(t.orderedOn).toEqual(FRIDAY);
    expect(t.shipsOn.getDate()).toBe(10);
    expect(t.arrivesBy.getDate()).toBe(13);
    expect(t.outForDeliveryOn.getTime()).toBeLessThan(t.arrivesBy.getTime());
    expect(t.outForDeliveryOn.getTime()).toBeGreaterThanOrEqual(t.shipsOn.getTime());
  });
  it("never arrives before it ships, even for a one day product", () => {
    const t = timelineFor({ deliveryDays: 1 }, FRIDAY);
    expect(t.arrivesBy.getTime()).toBeGreaterThanOrEqual(t.shipsOn.getTime());
    expect(t.outForDeliveryOn.getTime()).toBeGreaterThanOrEqual(t.shipsOn.getTime());
  });
  it("order, ship, out for delivery and arrival are in order for every product", () => {
    for (const p of PRODUCTS) {
      const t = timelineFor(p, FRIDAY);
      expect(t.shipsOn.getTime(), p.id).toBeGreaterThan(t.orderedOn.getTime());
      expect(t.outForDeliveryOn.getTime(), p.id).toBeGreaterThanOrEqual(t.shipsOn.getTime());
      expect(t.arrivesBy.getTime(), p.id).toBeGreaterThanOrEqual(t.outForDeliveryOn.getTime());
    }
  });
  it("counts across a month end", () => {
    const t = timelineFor({ deliveryDays: 4 }, new Date(2026, 9, 29));
    expect(t.arrivesBy.getMonth()).toBe(10);
    expect(t.arrivesBy.getDate()).toBe(2);
  });
});

describe("delivery lines", () => {
  const p = toDTO(PRODUCTS.find((x) => x.id === "jeans-levis-511")!);
  it("say dispatch, arrival with the address, free delivery, returns, seller, stock and the next step", () => {
    const t = deliveryLines(p, "en", FRIDAY, META).map((l) => l.caption);
    expect(t.length).toBe(7);
    expect(t[0]).toBe("If you order today, it ships on Saturday, 10 October.");
    expect(t[1]).toBe("It reaches 12 Rose Lane, Hyderabad by Sunday, 11 October.");
    expect(t[2]).toMatch(/free/i);
    expect(t[3]).toBe(`You can return it within ${p.returnDays} days.`);
    expect(t[4]).toBe(`Sold by ${p.seller.en}.`);
    expect(t[5]).toMatch(/in stock/);
    expect(t[6]).toMatch(/add to cart/);
  });
  it("warns when stock is low, with the real number", () => {
    const low = PRODUCTS.find((x) => x.stock <= 10)!;
    expect(deliveryLines(toDTO(low), "en", FRIDAY, META).map((l) => l.caption).join(" ")).toContain(`Only ${low.stock} left`);
  });
  it("every language says the same dates and numbers", () => {
    for (const l of LANGS) {
      const text = deliveryLines(p, l, FRIDAY, META).map((x) => x.caption).join(" ");
      expect(text).toContain("10");
      expect(text).toContain("11");
      expect(text).toContain(String(p.returnDays));
    }
  });
});
