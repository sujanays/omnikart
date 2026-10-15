"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Payment } from "@/contract";
import { cartTotal, deliveryDate, getProduct, maxDeliveryDays } from "@/store/catalogue";
import { useShop, useToday } from "@/store/client/useStore";
import { formatDate } from "@/store/format";
import { STORE_ADDRESS } from "@/store/identity";
import { rupees, ui } from "@/store/ui-text";
import { whatsappLink } from "@/store/share";

const PAYMENTS: Payment[] = ["cod", "online"];

/**
 * Amazon-style checkout: address, payment, review. The Place your order button places the order.
 * A helper (such as a voice guide) may hold the button until it is safe; the page then says why.
 */
export function CheckoutPage() {
  const shop = useShop();
  const router = useRouter();
  const { lang, cart, payment, lock } = shop;
  const today = useToday();

  if (cart.length === 0) {
    return (
      <div className="s-page">
        <div className="s-box">
          <h1>{ui("checkoutTitle", lang)}</h1>
          <p>{ui("cartEmpty", lang)}</p>
          <Link className="s-btn" href="/">
            {ui("keepShopping", lang)}
          </Link>
        </div>
      </div>
    );
  }
  const total = cartTotal(cart);
  const when = today ? formatDate(deliveryDate(maxDeliveryDays(cart), today), lang) : "";

  const place = async () => {
    if (lock.locked) return;
    const order = await shop.placeOrder(payment);
    if (order) router.push("/orders");
  };

  return (
    <div className="s-page">
      <h1 style={{ marginTop: 0 }}>{ui("checkoutTitle", lang)}</h1>
      <p className="s-delivery">{ui("demoOnly", lang)}</p>
      <div className="s-cartgrid">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="s-box s-step" aria-labelledby="st-addr">
            <h2 id="st-addr">{ui("stepAddress", lang)}</h2>
            <label className="s-radio">
              <input type="radio" name="addr" defaultChecked />
              <span>{STORE_ADDRESS.full[lang]}</span>
            </label>
          </section>

          <fieldset className="s-box s-step" style={{ margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: "1.15rem", padding: "0 0.4rem" }}>{ui("stepPayment", lang)}</legend>
            {PAYMENTS.map((p) => (
              <label key={p} className="s-radio">
                <input type="radio" name="pay" checked={payment === p} onChange={() => shop.setPayment(p)} />
                <span>{ui(p === "cod" ? "cod" : "online", lang)}</span>
              </label>
            ))}
          </fieldset>

          <section className="s-box s-step s-reading" id="readback" data-reading-label={ui("omnikartReading", lang)} aria-labelledby="st-rev">
            <h2 id="st-rev">{ui("stepReview", lang)}</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cart.map((l) => {
                const p = getProduct(l.id);
                if (!p) return null;
                return (
                  <li key={l.id} className="s-cartitem" style={{ gridTemplateColumns: "5rem minmax(0,1fr) auto" }}>
                    <Image src={p.photo} alt="" width={80} height={80} unoptimized />
                    <div>
                      <strong>{p.name[lang]}</strong>
                      <p className="s-delivery" style={{ margin: 0 }}>
                        {ui("qtyLabel", lang)}: {l.qty}
                        {when && <> · {ui("getItBy", lang, { date: when })}</>}
                      </p>
                    </div>
                    <strong>{rupees(p.price * l.qty)}</strong>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="s-box s-sum" aria-labelledby="sum-title">
          <h2 id="sum-title">{ui("orderSummary", lang)}</h2>
          <dl>
            <dt>{ui("itemsLabel", lang)}:</dt>
            <dd>{rupees(total)}</dd>
            <dt>{ui("deliveryLabel", lang)}:</dt>
            <dd>{ui("freeWord", lang)}</dd>
          </dl>
          <p className="s-total" aria-label={`${ui("orderTotal", lang)} ${rupees(total)}`}>
            {ui("orderTotal", lang)}: {rupees(total)}
          </p>
          <p aria-live="polite" className="s-delivery" id="place-lock">
            {lock.locked ? lock.message : ""}
          </p>
          <p style={{ margin: "0.6rem 0" }}>
            <button id="place-order" type="button" className="s-btn wide" aria-disabled={lock.locked} aria-describedby="place-lock" onClick={() => void place()}>
              {ui("placeYourOrder", lang)}
            </button>
          </p>
          <button type="button" className="s-btn plain wide" onClick={() => router.push("/cart")}>
            {ui("cancel", lang)}
          </button>
          <p style={{ marginTop: "0.6rem" }}>
            <a className="s-btn plain wide" href={whatsappLink(cart, lang)} target="_blank" rel="noopener noreferrer">
              {ui("shareCart", lang)} {ui("opensWhatsapp", lang)}
            </a>
          </p>
        </aside>
      </div>
    </div>
  );
}
