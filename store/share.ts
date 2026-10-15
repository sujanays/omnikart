import type { Lang } from "@/contract/lang";
import type { CartLine } from "@/contract";
import { cartTotal, getProduct } from "@/store/catalogue";
import { joinList } from "@/store/format";
import { rupees, ui } from "@/store/ui-text";

/**
 * "Ask someone to check": a WhatsApp message with the cart in words, so a trusted person
 * can look before any money moves. Built from catalogue data, like everything else we read out.
 */
export function shareMessage(cart: CartLine[], lang: Lang): string {
  const items = joinList(
    cart.map((l) => `${l.qty} ${getProduct(l.id)?.name[lang] ?? l.id}`),
    lang,
  );
  return ui("shareMessage", lang, { items, total: rupees(cartTotal(cart)) });
}

export function whatsappLink(cart: CartLine[], lang: Lang): string {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(cart, lang))}`;
}
