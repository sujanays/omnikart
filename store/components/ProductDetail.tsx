"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getProduct, productsIn, sortProducts } from "@/store/catalogue";
import { reviewSummary, specLabel, specValueText } from "@/store/derive";
import { formatDate, timelineFor } from "@/store/format";
import { sellerIn } from "@/store/content/brands";
import { useShop, useToday } from "@/store/client/useStore";
import { rupees, ui } from "@/store/ui-text";
import type { Product } from "@/store/catalogue-types";
import { Badges, DeliveryBy, PriceBlock, Stars } from "@/store/components/parts";

function Gallery({ p, lang }: { p: Product; lang: "en" | "hi" | "te" }) {
  const [i, setI] = useState(0);
  return (
    <div className="s-gallery">
      <div className="s-thumbs" role="group" aria-label={p.name[lang]}>
        {p.gallery.map((src, n) => (
          <button key={src} type="button" aria-pressed={n === i} aria-label={`${p.name[lang]} ${n + 1}`} onClick={() => setI(n)}>
            <Image src={src} alt="" width={54} height={54} unoptimized />
          </button>
        ))}
      </div>
      <Image className="s-main-img" src={p.gallery[i]} alt={i === 0 ? p.look[lang] : `${p.name[lang]} ${i + 1}`} width={400} height={400} unoptimized priority />
    </div>
  );
}

function BuyBox({ p, lang }: { p: Product; lang: "en" | "hi" | "te" }) {
  const shop = useShop();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const max = Math.min(p.stock, 10);
  return (
    <section className="s-buy" aria-label={ui("addToCart", lang)}>
      <div className="s-price">
        <span className="rs">₹</span>
        {p.price.toLocaleString("en-IN")}
      </div>
      <DeliveryBy days={p.deliveryDays} lang={lang} />
      <p className="s-ok" style={{ margin: 0 }}>
        {p.stock <= 10 ? ui("lowStockLine", lang, { n: p.stock }) : ui("inStockLine", lang)}
      </p>
      <div>
        <label htmlFor="qty">{ui("qtyLabel", lang)}: </label>
        <select id="qty" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
          {Array.from({ length: max }, (_, n) => (
            <option key={n + 1} value={n + 1}>
              {n + 1}
            </option>
          ))}
        </select>
      </div>
      <button id="add-to-cart" type="button" className="s-btn wide" onClick={() => shop.addToCart(p.id, qty)}>
        {ui("addToCart", lang)}
      </button>
      <button type="button" className="s-btn orange wide" onClick={() => void shop.addToCart(p.id, qty).then(() => router.push("/checkout"))}>
        {ui("buyNow", lang)}
      </button>
      <dl>
        <dt>{ui("soldBy", lang)}</dt>
        <dd>{sellerIn(p.seller, lang)}</dd>
        <dt>{ui("returnsLabel", lang)}</dt>
        <dd>{ui("returnPolicy", lang, { n: p.returnDays })}</dd>
        <dt>{ui("payment", lang)}</dt>
        <dd>{ui("secure", lang)}</dd>
      </dl>
    </section>
  );
}

/** Ordered today, shipped tomorrow, out for delivery, delivered by. The same dates Omnikart reads aloud. */
function Timeline({ p, lang }: { p: Product; lang: "en" | "hi" | "te" }) {
  const today = useToday();
  if (!today) return null;
  const t = timelineFor(p.deliveryDays, today);
  const steps: [string, Date][] = [
    [ui("tlOrdered", lang), t.orderedOn],
    [ui("tlShipped", lang), t.shipsOn],
    [ui("tlOut", lang), t.outForDeliveryOn],
    [ui("tlDelivered", lang), t.arrivesBy],
  ];
  return (
    <section id="delivery" className="s-box s-reading" data-reading-label={ui("omnikartReading", lang)} aria-labelledby="tl-title">
      <h2 id="tl-title">{ui("timelineTitle", lang)}</h2>
      <ol className="s-timeline">
        {steps.map(([label, d]) => (
          <li key={label}>
            <strong>{label}</strong>
            {formatDate(d, lang)}
          </li>
        ))}
      </ol>
      <p className="s-delivery">
        {ui("freeDelivery", lang)} · {ui("returnPolicy", lang, { n: p.returnDays })} · {ui("soldBy", lang)} {sellerIn(p.seller, lang)}
      </p>
    </section>
  );
}

function Histogram({ p, lang }: { p: Product; lang: "en" | "hi" | "te" }) {
  return (
    <div>
      <p className="s-rating" style={{ fontSize: "1.1rem" }}>
        <Stars rating={p.rating} lang={lang} /> <strong>{ui("outOf5", lang, { r: p.rating })}</strong>
      </p>
      <p className="s-delivery">{ui("ratingsCount", lang, { n: p.ratingCount.toLocaleString("en-IN") })}</p>
      <div className="s-hist" role="table" aria-label={ui("customerReviews", lang)}>
        {p.histogram.map((pct, i) => (
          <div key={i} className="s-hist-row" role="row">
            <span role="cell">{ui("starN", lang, { n: 5 - i })}</span>
            <span className="s-hist-bar" role="cell" aria-hidden="true">
              <span className="s-hist-fill" style={{ display: "block", width: `${pct}%` }} />
            </span>
            <span role="cell">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductDetail({ id }: { id: string }) {
  const { lang } = useShop();
  const p = getProduct(id);
  if (!p) return null;
  const summary = reviewSummary(p, lang);
  const verdictKey = summary.verdict === "happy" ? "verdictHappy" : summary.verdict === "mostly" ? "verdictMostly" : "verdictMixed";
  const similar = sortProducts(productsIn(p.category).filter((x) => x.id !== p.id)).slice(0, 4);

  return (
    <div className="s-page">
      <article className="s-box" aria-labelledby="pdp-title">
        <div className="s-pdp">
          <Gallery p={p} lang={lang} />
          <div>
            <h1 id="pdp-title">{p.name[lang]}</h1>
            <p className="s-brandline" style={{ margin: "0 0 0.3rem" }}>
              {p.brand}
            </p>
            <p className="s-rating">
              <Stars rating={p.rating} lang={lang} /> <strong>{p.rating}</strong> <a href="#reviews">{ui("ratingsCount", lang, { n: p.ratingCount.toLocaleString("en-IN") })}</a>
            </p>
            <p style={{ margin: "0.3rem 0" }}>
              <Badges p={p} lang={lang} />
            </p>
            <hr />
            <PriceBlock p={p} lang={lang} big />
            <p className="s-delivery">{ui("inclTax", lang)}</p>
            <hr />
            <div className="s-about">
              <h2 style={{ fontSize: "1.1rem" }}>{ui("aboutItem", lang)}</h2>
              <ul>
                {p.specs.slice(0, 6).map((s) => (
                  <li key={s.key}>
                    <strong>{specLabel(s, lang)}:</strong> {specValueText(s, lang)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <BuyBox p={p} lang={lang} />
        </div>
      </article>

      <Timeline p={p} lang={lang} />

      <section className="s-box" aria-labelledby="specs-title">
        <table className="s-table">
          <caption id="specs-title">{ui("specsCaption", lang)}</caption>
          <tbody>
            {p.specs.map((s) => (
              <tr key={s.key}>
                <th scope="row">{specLabel(s, lang)}</th>
                <td>{specValueText(s, lang)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">{ui("soldBy", lang)}</th>
              <td>{sellerIn(p.seller, lang)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="reviews" className="s-box" aria-labelledby="rev-title">
        <h2 id="rev-title">{ui("customerReviews", lang)}</h2>
        <div className="s-two">
          <Histogram p={p} lang={lang} />
          <div>
            <h3>{ui("customersSay", lang)}</h3>
            <ul>
              {summary.pros.length > 0 && (
                <li>
                  <strong>{ui("liked", lang)}:</strong> {summary.pros.join(", ")}
                </li>
              )}
              {summary.cons.length > 0 && (
                <li>
                  <strong>{ui("disliked", lang)}:</strong> {summary.cons.join(", ")}
                </li>
              )}
              <li>{ui(verdictKey, lang)}</li>
            </ul>
            <p className="s-delivery">{ui("reviewsHeading", lang)}: {summary.reviewCount}</p>
          </div>
        </div>

        {p.access.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h3>{ui("accessHeading", lang)}</h3>
            <p className="s-delivery">{ui("accessIntro", lang)}</p>
            {p.access.map((a, i) => (
              <blockquote key={i} className="s-note">
                <cite>{a.by[lang]}</cite>
                {a.text[lang]}
              </blockquote>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: "1rem" }}>{ui("topReviews", lang)}</h3>
        <ul className="s-reviews">
          {p.reviews.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Stars rating={r.stars} lang={lang} /> <span lang={r.lang === "hi" ? "hi" : "en"}>{r.text}</span>
            </li>
          ))}
        </ul>
        {p.reviews.length > 6 && (
          <details>
            <summary>{ui("allReviews", lang, { n: p.reviews.length })}</summary>
            <ul className="s-reviews" tabIndex={0} aria-label={ui("allReviews", lang, { n: p.reviews.length })} style={{ maxHeight: "24rem", overflow: "auto" }}>
              {p.reviews.slice(6).map((r) => (
                <li key={r.id}>
                  <Stars rating={r.stars} lang={lang} /> <span lang={r.lang === "hi" ? "hi" : "en"}>{r.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="s-box s-row">
        <h2 id="sim-title">{ui("similarItems", lang)}</h2>
        <div className="s-scroller" role="region" tabIndex={0} aria-label={ui("similarItems", lang)}>
          {similar.map((x) => (
            <Link key={x.id} href={`/product/${x.id}`} className="s-tile">
              <Image src={x.photo} alt="" width={192} height={192} unoptimized />
              <span className="s-clamp">{x.name[lang]}</span>
              <strong>{rupees(x.price)}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
