"use client";

import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/store/catalogue-types";
import { productsIn, sortProducts } from "@/store/catalogue";
import { CATEGORY_NAME } from "@/store/content/dictionary";
import { useShop } from "@/store/client/useStore";
import { rupees, ui } from "@/store/ui-text";
import { Stars } from "@/store/components/parts";

/** The store's home page: a hero, a card for each category, and a row of best sellers under each. */
export function HomeView() {
  const { lang } = useShop();
  return (
    <div className="s-page">
      <section className="s-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">{ui("heroTitle", lang)}</h1>
        <p>{ui("heroSub", lang)}</p>
      </section>

      <ul className="s-cats" style={{ listStyle: "none", padding: 0 }}>
        {CATEGORIES.map((c) => {
          const top = sortProducts(productsIn(c)).slice(0, 4);
          const name = CATEGORY_NAME[c][lang];
          return (
            <li key={c} className="s-box s-cat">
              <h2>{ui("shopCategory", lang, { cat: name })}</h2>
              <Link href={`/s?c=${c}`} className="s-cat" aria-label={ui("shopCategory", lang, { cat: name })}>
                <div className="pics">
                  {top.map((p) => (
                    <Image key={p.id} src={p.photo} alt="" width={120} height={120} unoptimized />
                  ))}
                </div>
              </Link>
              <p style={{ margin: "0.5rem 0 0" }}>
                <Link href={`/s?c=${c}`}>{ui("seeAll", lang, { cat: name })}</Link>
              </p>
            </li>
          );
        })}
      </ul>

      {CATEGORIES.map((c) => {
        const name = CATEGORY_NAME[c][lang];
        const best = productsIn(c)
          .slice()
          .sort((a, b) => b.ratingCount - a.ratingCount)
          .slice(0, 8);
        return (
          <section key={c} className="s-box s-row">
            <h2 id={`row-${c}`}>{ui("bestSellersIn", lang, { cat: name })}</h2>
            <div className="s-scroller" role="region" tabIndex={0} aria-label={ui("bestSellersIn", lang, { cat: name })}>
              {best.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="s-tile">
                  <Image src={p.photo} alt="" width={192} height={192} unoptimized />
                  <span className="s-clamp">{p.name[lang]}</span>
                  <span className="s-rating">
                    <Stars rating={p.rating} lang={lang} /> <span>{p.ratingCount.toLocaleString("en-IN")}</span>
                  </span>
                  <br />
                  <strong>{rupees(p.price)}</strong>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
