import type { Lang } from "@/contract/lang";
import type { CartLine, Confirmation, Order, Payment, ProductDTO, StoreMeta } from "@/contract";
import { checkConfirm } from "@/assistant/lexicon";
import { addDays } from "@/assistant/agent/delivery";
import { PAYMENT_NAME, formatDate, joinList, line, spelled, type Line } from "@/assistant/agent/templates";
import type { Ctx, Outcome, Snapshot } from "@/assistant/agent/state";

/**
 * Safe checkout. The only way to place an order is:
 *   - the read-back finished playing without being interrupted, AND
 *   - the shopper says yes AND an order word ("yes, place order"), or presses the labelled button.
 * Silence, "maybe", a bare "yes", or a low confidence hearing never counts.
 * The total is added up here from the store's prices. The LLM never sees or writes it.
 * The store checks again: it refuses an order that arrives without a confirmation.
 */

export interface CartItem {
  p: ProductDTO;
  qty: number;
}

/** The products of a cart, from the store. Lines for products the store no longer knows are dropped. */
export async function loadCart(snap: Pick<Snapshot, "store">, cart: CartLine[]): Promise<CartItem[]> {
  const products = await snap.store.getProducts(cart.map((l) => l.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.flatMap((l) => (byId.has(l.id) ? [{ p: byId.get(l.id)!, qty: l.qty }] : []));
}

export const totalOf = (items: CartItem[]): number => items.reduce((n, i) => n + i.p.price * i.qty, 0);
export const maxDays = (items: CartItem[]): number => items.reduce((m, i) => Math.max(m, i.p.deliveryDays), 0);

export function readbackLines(items: CartItem[], payment: Payment, lang: Lang, now: Date, meta: StoreMeta): Line[] {
  const total = totalOf(items);
  const list = joinList(
    items.map((i) => `${i.qty} ${i.p.name[lang]}`),
    lang,
  );
  const when = formatDate(addDays(now, maxDays(items)), lang);
  const flag = { readback: true };
  return [
    line("rb_intro", {}, lang, flag),
    line("rb_items", { items: list }, lang, flag),
    line("rb_address", { address: meta.address.full[lang] }, lang, flag),
    line("rb_delivery", { date: when }, lang, flag),
    line("rb_payment", { method: PAYMENT_NAME[payment][lang] }, lang, flag),
    line("rb_total", { total: { money: total } }, lang, flag),
    line("rb_digits", { digits: spelled(String(total)) }, lang, flag),
    line("rb_confirm", {}, lang, flag),
  ];
}

export async function placeOrder(snap: Snapshot, confirmation: Confirmation): Promise<Outcome> {
  const lang = snap.lang;
  const ck = snap.ctx.checkout;
  if (snap.cart.length === 0) return { lines: [line("checkout_empty", {}, lang)] };
  if (!ck || snap.ctx.screen !== "checkout" || !ck.readbackDone) {
    return { lines: [line("checkout_need_summary", {}, lang)], remember: false };
  }
  const res = await snap.store.checkout({ payment: ck.payment, confirmation });
  if (!res.ok) {
    return { lines: [line(res.reason === "empty_cart" ? "checkout_empty" : "checkout_need_summary", {}, lang)], remember: false };
  }
  const order: Order = res.order;
  const when = formatDate(addDays(new Date(order.placedAt), order.deliveryDays), lang);
  return {
    lines: [line("ordered", { digits: spelled(order.id), date: when }, lang)],
    cart: [],
    orders: [order, ...snap.orders],
    ctx: { screen: "ordered", checkout: null, lastOrderId: order.id, options: [], productId: null },
    nav: snap.meta.urls.orders,
  };
}

/**
 * What to do with a sentence while the shopper is at the checkout.
 * Returns null when the sentence is not about confirming, so normal handling continues.
 */
export async function handleCheckoutUtterance(text: string, snap: Snapshot): Promise<Outcome | null> {
  if (snap.ctx.screen !== "checkout" || !snap.ctx.checkout) return null;
  const lang = snap.lang;
  const verdict = checkConfirm(text, snap.inputLang);
  if (verdict === "cancel") {
    return { lines: [line("checkout_cancelled", {}, lang)], ctx: { screen: "home", checkout: null }, nav: snap.meta.urls.cart };
  }
  if (verdict === "confirm") return placeOrder(snap, { method: "voice", phrase: text.slice(0, 80) });
  return null;
}

/** The labelled "Place order" choice in one-key mode. Same rule as speech: the read-back must have finished. */
export async function placeOrderByButton(snap: Snapshot): Promise<Outcome> {
  return placeOrder(snap, { method: "button" });
}

export function checkoutUi(ctx: Ctx): { canPlace: boolean } {
  return { canPlace: ctx.screen === "checkout" && !!ctx.checkout?.readbackDone };
}
