"use client";

import { useSyncExternalStore } from "react";
import type { CartLine, Filters, Order, Payment } from "@/contract";
import { isLang, type Lang } from "@/contract/lang";

/**
 * The store page's own state: language, cart, orders, the filters on the results page, the payment
 * method, and whether the Place order button is locked. Nothing here knows about any assistant.
 * The cart and orders are fetched from, and saved to, the store's own API.
 */

export interface StoreClientState {
  lang: Lang;
  hydrated: boolean;
  cart: CartLine[];
  orders: Order[];
  /** filters on the results page, and the category they belong to */
  filters: Filters;
  filtersCategory: string | null;
  payment: Payment;
  /** an outside helper (such as a voice guide) can hold the Place order button until it is safe */
  lock: { locked: boolean; message: string };
  /** text for the page's live region, for screen readers */
  announcement: string;
}

const LANG_KEY = "haat:lang";

function initial(): StoreClientState {
  return {
    lang: "en",
    hydrated: false,
    cart: [],
    orders: [],
    filters: { sel: {} },
    filtersCategory: null,
    payment: "cod",
    lock: { locked: false, message: "" },
    announcement: "",
  };
}

type Listener = () => void;

class ClientStore {
  private state = initial();
  private server = initial();
  private listeners = new Set<Listener>();
  get = () => this.state;
  getServer = () => this.server;
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  set = (patch: Partial<StoreClientState> | ((s: StoreClientState) => Partial<StoreClientState>)) => {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  };
}

export const storeState = new ClientStore();

export function useStoreState(): StoreClientState {
  return useSyncExternalStore(storeState.subscribe, storeState.get, storeState.getServer);
}

export function readSavedLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked: the page still works */
  }
}

/* ---------------- the store's own API, from the browser ---------------- */

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/store/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 409) throw new Error(`store ${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function refreshCartAndOrders(): Promise<void> {
  try {
    const [cart, orders] = await Promise.all([api<CartLine[]>("cart"), api<Order[]>("orders")]);
    storeState.set({ cart, orders });
  } catch {
    /* offline: keep what is on screen */
  }
}

export async function saveCart(lines: CartLine[]): Promise<void> {
  try {
    const cart = await api<CartLine[]>("cart", { lines });
    storeState.set({ cart });
  } catch {
    /* offline: the cart on screen is unchanged */
  }
}

export async function placeOrderFromButton(payment: Payment): Promise<Order | null> {
  try {
    const r = await api<{ ok: boolean; order?: Order }>("checkout", { payment, confirmation: { method: "button" } });
    await refreshCartAndOrders();
    return r.ok && r.order ? r.order : null;
  } catch {
    return null;
  }
}

export async function returnLatestOrder(): Promise<void> {
  const latest = storeState.get().orders[0];
  if (!latest) return;
  try {
    await api<Order>(`orders/${latest.id}/return`, {});
  } finally {
    await refreshCartAndOrders();
  }
}
