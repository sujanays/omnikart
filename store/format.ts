import { LANG_TAG, type Lang } from "@/contract/lang";

/** "Wednesday, 14 October" in the page language. */
export function formatDate(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LANG_TAG[lang], { weekday: "long", day: "numeric", month: "long" }).format(d);
}

export function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const and: Record<Lang, string> = { en: "and", hi: "और", te: "మరియు" };
  return `${items.slice(0, -1).join(", ")} ${and[lang]} ${items[items.length - 1]}`;
}

/** Ships tomorrow, arrives after the product's own days (never sooner than two), out for delivery the day before. */
export function timelineFor(deliveryDays: number, now: Date) {
  const add = (n: number) => {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + n);
    return d;
  };
  const arrivesBy = add(Math.max(2, deliveryDays));
  const shipsOn = add(1);
  const out = new Date(arrivesBy.getTime());
  out.setDate(out.getDate() - 1);
  return { orderedOn: now, shipsOn, outForDeliveryOn: out.getTime() < shipsOn.getTime() ? shipsOn : out, arrivesBy };
}
