import type { Lang } from "@/contract/lang";
import type { ProductDTO, StoreMeta } from "@/contract";
import { formatDate, line, type Line } from "@/assistant/agent/templates";

/**
 * The delivery timeline: ordered today, shipped tomorrow, out for delivery the day before, delivered by the date.
 * Every date is counted from today with the product's own delivery days from the store, never written by the AI.
 */

export interface Timeline {
  orderedOn: Date;
  shipsOn: Date;
  outForDeliveryOn: Date;
  arrivesBy: Date;
}

export const addDays = (from: Date, n: number): Date => {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + n);
  return d;
};

/** Ships the next day; arrives after the product's own days, and never sooner than two. */
export function timelineFor(p: Pick<ProductDTO, "deliveryDays">, now: Date): Timeline {
  const arrivesBy = addDays(now, Math.max(2, p.deliveryDays));
  const shipsOn = addDays(now, 1);
  const out = addDays(arrivesBy, -1);
  return { orderedOn: now, shipsOn, outForDeliveryOn: out.getTime() < shipsOn.getTime() ? shipsOn : out, arrivesBy };
}

/** What Omnikart says for "when will it come". */
export function deliveryLines(p: ProductDTO, lang: Lang, now: Date, meta: StoreMeta): Line[] {
  const t = timelineFor(p, now);
  return [
    line("delivery_dispatch", { ship: formatDate(t.shipsOn, lang) }, lang),
    line("delivery_arrive", { address: meta.address.short[lang], date: formatDate(t.arrivesBy, lang) }, lang),
    line("delivery_free", {}, lang),
    line("delivery_return", { days: p.returnDays }, lang),
    line("delivery_seller", { seller: p.seller[lang] }, lang),
    p.stock <= 10 ? line("product_low_stock", { stock: p.stock }, lang) : line("delivery_stock", {}, lang),
    line("delivery_next", {}, lang),
  ];
}
