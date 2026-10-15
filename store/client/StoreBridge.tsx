"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UI_EVENT,
  type AnnounceDetail,
  type CheckoutLockDetail,
  type FiltersDetail,
  type HighlightDetail,
  type LanguageDetail,
  type MarkDetail,
  type NavigateDetail,
  type PageDetail,
} from "@/contract";
import { LANG_TAG } from "@/contract/lang";
import { readSavedLang, refreshCartAndOrders, saveLang, storeState, useStoreState } from "@/store/client/state";

/**
 * The store's side of the UI hooks. It listens for the few requests a helper may make of the page
 * (go here, outline this, say this, set these filters, lock the order button) and reports which page is
 * showing. It never touches anything outside the store, and it works the same with nobody listening.
 */

export function reportPage(detail: PageDetail): void {
  window.dispatchEvent(new CustomEvent<PageDetail>(UI_EVENT.page, { detail }));
}

function on<T>(name: string, fn: (d: T) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<T>).detail);
  window.addEventListener(name, h);
  return () => window.removeEventListener(name, h);
}

/** Pages that know their own contents (the results page) report themselves; the rest are reported here. */
function PageReporter() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.toString();
  useEffect(() => {
    if (pathname === "/s") return;
    if (pathname.startsWith("/product/")) reportPage({ kind: "product", productId: decodeURIComponent(pathname.split("/")[2] ?? "") });
    else if (pathname === "/cart") reportPage({ kind: "cart" });
    else if (pathname === "/checkout") reportPage({ kind: "checkout" });
    else if (pathname === "/orders") reportPage({ kind: "orders" });
    else if (pathname === "/") reportPage({ kind: "home" });
  }, [pathname, key]);
  return null;
}

export function StoreBridge() {
  const router = useRouter();
  const lang = useStoreState().lang;

  // first load: saved language, cart and orders from the store's API
  useEffect(() => {
    const saved = readSavedLang();
    storeState.set({ hydrated: true, ...(saved ? { lang: saved } : {}) });
    void refreshCartAndOrders();
  }, []);

  useEffect(() => {
    document.documentElement.lang = LANG_TAG[lang];
  }, [lang]);

  useEffect(() => {
    const offs = [
      on<NavigateDetail>(UI_EVENT.navigate, (d) => {
        if (typeof d.url === "string" && d.url.startsWith("/")) router.push(d.url);
      }),
      on<HighlightDetail>(UI_EVENT.highlight, (d) => {
        const mode = d.mode ?? "reading";
        const attr = mode === "scan" ? "data-scan" : "data-speaking";
        document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
        if (!d.id) return;
        const el = document.getElementById(d.id);
        if (!el) return;
        if (d.label) el.setAttribute("data-reading-label", d.label);
        el.setAttribute(attr, "true");
      }),
      on<MarkDetail>(UI_EVENT.mark, (d) => {
        document.querySelectorAll("[data-offered]").forEach((el) => el.removeAttribute("data-offered"));
        for (const m of d.marks) document.getElementById(m.id)?.setAttribute("data-offered", "true");
      }),
      on<AnnounceDetail>(UI_EVENT.announce, (d) => storeState.set({ announcement: d.text })),
      on<FiltersDetail>(UI_EVENT.setFilters, (d) => storeState.set({ filters: d.filters, filtersCategory: d.category })),
      on<LanguageDetail>(UI_EVENT.setLanguage, (d) => {
        storeState.set({ lang: d.lang });
        saveLang(d.lang);
      }),
      on<CheckoutLockDetail>(UI_EVENT.checkoutLock, (d) => storeState.set({ lock: { locked: d.locked, message: d.message ?? "" } })),
      on<Record<string, never>>(UI_EVENT.cartChanged, () => void refreshCartAndOrders()),
    ];
    return () => offs.forEach((o) => o());
  }, [router]);

  return (
    <>
      <Suspense fallback={null}>
        <PageReporter />
      </Suspense>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
        {useStoreState().announcement}
      </div>
    </>
  );
}
