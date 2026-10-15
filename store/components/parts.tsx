"use client";

import type { Lang } from "@/contract/lang";
import type { Product } from "@/store/catalogue-types";
import { deliveryDate } from "@/store/catalogue";
import { formatDate } from "@/store/format";
import { useToday } from "@/store/client/useStore";
import { rupees, ui } from "@/store/ui-text";

/** Stars drawn as text, with the same number said in words for a screen reader. */
export function Stars({ rating, lang }: { rating: number; lang: Lang }) {
  const full = Math.round(rating);
  return (
    <span className="s-stars" role="img" aria-label={ui("outOf5", lang, { r: rating })}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  );
}

export const percentOff = (p: Pick<Product, "price" | "mrp">) => Math.round(((p.mrp - p.price) / p.mrp) * 100);

export function PriceBlock({ p, lang, big = false }: { p: Product; lang: Lang; big?: boolean }) {
  const off = percentOff(p);
  return (
    <div className="s-price-line">
      {off > 0 && <span className="s-off">−{off}%</span>}
      <span className="s-price" style={big ? { fontSize: "1.9rem" } : undefined}>
        <span className="rs">₹</span>
        {p.price.toLocaleString("en-IN")}
      </span>
      {p.mrp > p.price && (
        <span className="s-mrp">
          {ui("mrp", lang)} <del>{rupees(p.mrp)}</del>
        </span>
      )}
    </div>
  );
}

/** "FREE delivery Wednesday, 14 October". The date is worked out in the browser, from today. */
export function DeliveryBy({ days, lang }: { days: number; lang: Lang }) {
  const today = useToday();
  return (
    <p className="s-delivery">
      <strong>{ui("freeDelivery", lang)}</strong>
      {today && <> · {ui("getItBy", lang, { date: formatDate(deliveryDate(days, today), lang) })}</>}
    </p>
  );
}

export function Badges({ p, lang }: { p: Product; lang: Lang }) {
  return (
    <span>
      {p.bestSeller && <span className="s-badge best">{ui("bestSellerBadge", lang)}</span>} {p.choice && <span className="s-badge choice">{ui("choiceBadge", lang)}</span>}
    </span>
  );
}
