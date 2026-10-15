"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartTotal, getProduct } from "@/store/catalogue";
import { useShop } from "@/store/client/useStore";
import { rupees, ui } from "@/store/ui-text";
import { whatsappLink } from "@/store/share";
import { DeliveryBy } from "@/store/components/parts";

export function CartPage() {
  const shop = useShop();
  const router = useRouter();
  const { lang, cart } = shop;

  if (cart.length === 0) {
    return (
      <div className="s-page">
        <div className="s-box">
          <h1>{ui("shoppingCart", lang)}</h1>
          <p>{ui("cartEmpty", lang)}</p>
          <Link className="s-btn" href="/">
            {ui("keepShopping", lang)}
          </Link>
        </div>
      </div>
    );
  }
  const count = cart.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="s-page">
      <div className="s-cartgrid">
        <section className="s-box" aria-labelledby="cart-title">
          <h1 id="cart-title">{ui("shoppingCart", lang)}</h1>
          <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {cart.map((l) => {
              const p = getProduct(l.id);
              if (!p) return null;
              return (
                <li key={l.id} className="s-cartitem">
                  <Link href={`/product/${p.id}`} aria-hidden="true" tabIndex={-1}>
                    <Image src={p.photo} alt="" width={128} height={128} unoptimized />
                  </Link>
                  <div>
                    <h2>
                      <Link href={`/product/${p.id}`}>{p.name[lang]}</Link>
                    </h2>
                    <p className="s-ok" style={{ margin: 0 }}>
                      {p.stock <= 10 ? ui("lowStockLine", lang, { n: p.stock }) : ui("inStockLine", lang)}
                    </p>
                    <DeliveryBy days={p.deliveryDays} lang={lang} />
                    <div className="s-actions">
                      <label htmlFor={`q-${p.id}`}>{ui("qtyLabel", lang)}</label>
                      <select id={`q-${p.id}`} value={l.qty} onChange={(e) => shop.setQty(p.id, Number(e.target.value))}>
                        {Array.from({ length: Math.min(p.stock, 10) }, (_, n) => (
                          <option key={n + 1} value={n + 1}>
                            {n + 1}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="s-btn plain" onClick={() => shop.setQty(p.id, 0)}>
                        {ui("deleteItem", lang)}
                        <span className="sr-only">: {p.name[lang]}</span>
                      </button>
                    </div>
                  </div>
                  <strong>{rupees(p.price * l.qty)}</strong>
                </li>
              );
            })}
          </ul>
          <p style={{ textAlign: "right", fontSize: "1.1rem" }}>
            {ui("subtotal", lang, { n: count })}: <strong>{rupees(cartTotal(cart))}</strong>
          </p>
        </section>

        <aside className="s-box s-sum" aria-label={ui("orderSummary", lang)}>
          <p style={{ fontSize: "1.1rem" }}>
            {ui("subtotal", lang, { n: count })}: <strong>{rupees(cartTotal(cart))}</strong>
          </p>
          <button id="go-checkout" type="button" className="s-btn wide" onClick={() => router.push("/checkout")}>
            {ui("proceedBuy", lang)}
          </button>
          <p style={{ marginTop: "0.7rem" }}>
            <a className="s-btn plain wide" href={whatsappLink(cart, lang)} target="_blank" rel="noopener noreferrer">
              {ui("shareCart", lang)} {ui("opensWhatsapp", lang)}
            </a>
          </p>
        </aside>
      </div>
    </div>
  );
}
