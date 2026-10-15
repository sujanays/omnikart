"use client";

import { useSyncExternalStore } from "react";
import { UI_EVENT, type Category, type Filters, type FiltersDetail, type LanguageDetail, type Payment, type PaymentDetail } from "@/contract";
import type { Lang } from "@/contract/lang";
import { cartTotal, getProduct } from "@/store/catalogue";
import { emptyFilters, toggleOptionIn } from "@/store/client/filters";
import { placeOrderFromButton, refreshCartAndOrders, returnLatestOrder, saveCart, saveLang, storeState, useStoreState } from "@/store/client/state";

function emit<T>(name: string, detail: T): void {
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

/**
 * What the store's pages use. Cart changes go to the store's own API; filter, language and payment
 * changes are announced on `window` with the contract's events, so anything listening (a helper such
 * as a voice guide) can follow along. The store never asks who is listening.
 */
export function useShop() {
  const s = useStoreState();
  return {
    ...s,
    total: cartTotal(s.cart),

    async addToCart(id: string, qty = 1): Promise<void> {
      const p = getProduct(id);
      if (!p) return;
      const have = s.cart.find((l) => l.id === id)?.qty ?? 0;
      await saveCart([...s.cart.filter((l) => l.id !== id), { id, qty: Math.min(have + qty, p.stock) }]);
      emit(UI_EVENT.cartChanged, {});
    },

    setQty(id: string, qty: number): void {
      const max = getProduct(id)?.stock ?? 1;
      const next = Math.max(0, Math.min(qty, max));
      void saveCart(next === 0 ? s.cart.filter((l) => l.id !== id) : s.cart.map((l) => (l.id === id ? { ...l, qty: next } : l))).then(() => emit(UI_EVENT.cartChanged, {}));
    },

    setLang(lang: Lang): void {
      storeState.set({ lang });
      saveLang(lang);
      emit<LanguageDetail>(UI_EVENT.languageChanged, { lang });
    },

    setPayment(payment: Payment): void {
      storeState.set({ payment });
      emit<PaymentDetail>(UI_EVENT.paymentChanged, { payment });
    },

    /** Filters are set from the page itself. `category` says which category they belong to. */
    toggleFilter(category: Category, facetId: string, optionId: string): void {
      const next = toggleOptionIn(category, storeState.get().filters, facetId, optionId);
      storeState.set({ filters: next, filtersCategory: category });
      emit<FiltersDetail>(UI_EVENT.filtersChanged, { category, filters: next });
    },
    setRating(category: Category, min: number | undefined): void {
      const f: Filters = { ...storeState.get().filters };
      if (min === undefined) delete f.rating;
      else f.rating = min;
      storeState.set({ filters: f, filtersCategory: category });
      emit<FiltersDetail>(UI_EVENT.filtersChanged, { category, filters: f });
    },
    clearFilters(category: Category): void {
      storeState.set({ filters: emptyFilters(), filtersCategory: category });
      emit<FiltersDetail>(UI_EVENT.filtersChanged, { category, filters: emptyFilters() });
    },

    refresh: refreshCartAndOrders,
    placeOrder: async (payment: Payment) => {
      const order = await placeOrderFromButton(payment);
      emit(UI_EVENT.cartChanged, {});
      return order;
    },
    returnOrder: async () => {
      await returnLatestOrder();
      emit(UI_EVENT.cartChanged, {});
    },
  };
}

/**
 * Today, as a stable number. It is 0 while the page is being built on the server and the start of
 * today's date in the browser. Dates such as "Get it by Wednesday" must be worked out in the browser,
 * or a page built last week would promise last week's date.
 */
export function useToday(): Date | null {
  const day = useSyncExternalStore(
    () => () => undefined,
    () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
    },
    () => 0,
  );
  return day ? new Date(day) : null;
}
