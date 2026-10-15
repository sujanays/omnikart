"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LANGS, LANG_NATIVE_NAME } from "@/contract/lang";
import type { Category } from "@/contract";
import { CATEGORIES } from "@/store/catalogue-types";
import { findCategory } from "@/store/identity";
import { CATEGORY_NAME } from "@/store/content/dictionary";
import { useShop } from "@/store/client/useStore";
import { ui } from "@/store/ui-text";

/** The store's header: logo, delivery location, search with a category drop-down, language, orders, cart. */
export function StoreHeader() {
  const shop = useShop();
  const router = useRouter();
  const { lang, cart } = shop;
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const [cat, setCat] = useState<"" | Category>("");
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim() && !cat) return;
    const category = cat || findCategory(q);
    router.push(
      category
        ? `/s?c=${category}${q.trim() ? `&k=${encodeURIComponent(q.trim())}` : ""}`
        : `/s?k=${encodeURIComponent(q.trim())}`,
    );
  };

  return (
    <>
      <a className="skip" href="#main">
        {ui("skip", lang)}
      </a>
      <header className="s-header">
        <div className="s-top">
          <Link
            href="/"
            className="s-logo"
            aria-label={`${ui("storeName", lang)}, ${ui("navHome", lang)}`}
          >
            {ui("storeName", lang)}
          </Link>
          <div className="s-deliver">{ui("deliverTo", lang)}</div>
          <form
            className="s-search"
            role="search"
            aria-label={ui("searchLabel", lang)}
            onSubmit={submit}
          >
            <label className="sr-only" htmlFor="s-cat">
              {ui("searchCategory", lang)}
            </label>
            <select
              id="s-cat"
              value={cat}
              onChange={(e) => setCat(e.target.value as "" | Category)}
            >
              <option value="">{ui("allCategories", lang)}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_NAME[c][lang]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="s-q">
              {ui("searchLabel", lang)}
            </label>
            <input
              id="s-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ui("searchPlaceholder", lang)}
              autoComplete="off"
            />
            <button type="submit">{ui("searchBtn", lang)}</button>
          </form>
          <div
            className="s-lang"
            role="group"
            aria-label={ui("language", lang)}
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => shop.setLang(l)}
              >
                {LANG_NATIVE_NAME[l]}
              </button>
            ))}
          </div>
          <div className="s-link" aria-hidden="false">
            {ui("helloGuest", lang)}
            <strong>{ui("accountLists", lang)}</strong>
          </div>
          <Link href="/orders" className="s-link">
            <strong>{ui("returnsOrders", lang)}</strong>
          </Link>
          <Link href="/cart" className="s-link s-cart">
            <span className="n">{count}</span> <strong>{ui("navCart", lang)}</strong>
          </Link>
        </div>
        <nav className="s-nav" aria-label={ui("mainNav", lang)}>
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/s?c=${c}`}>
              {CATEGORY_NAME[c][lang]}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

export function StoreFooter() {
  const { lang } = useShop();
  return (
    <footer className="s-footer">
      <p>
        <a href="#main">{ui("backToTop", lang)}</a>
      </p>
      <p>{ui("footerNote", lang)}</p>
    </footer>
  );
}
