"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getProduct } from "@/store/catalogue";
import { useShop } from "@/store/client/useStore";
import { formatDate } from "@/store/format";
import { STORE_ADDRESS } from "@/store/identity";
import { rupees, ui } from "@/store/ui-text";

export function OrdersPage() {
  const shop = useShop();
  const { lang, orders } = shop;
  const [tracked, setTracked] = useState<string | null>(null);
  return (
    <div className="s-page">
      <h1 style={{ marginTop: 0 }}>{ui("ordersTitle", lang)}</h1>
      {orders.length === 0 && (
        <div className="s-box">
          <p>{ui("ordersNone", lang)}</p>
          <Link className="s-btn" href="/">
            {ui("keepShopping", lang)}
          </Link>
        </div>
      )}
      {orders.map((o, i) => {
        const arrives = new Date(o.placedAt + o.deliveryDays * 86_400_000);
        const status = `${ui(o.status === "return" ? "statusReturn" : "statusPacked", lang)} · ${ui("getItBy", lang, { date: formatDate(arrives, lang) })}`;
        return (
          <section key={o.id} className="s-order" aria-labelledby={`o-${o.id}`}>
            <div className="s-order-head">
              <div>
                {ui("orderPlacedOn", lang)}
                <strong>{formatDate(new Date(o.placedAt), lang)}</strong>
              </div>
              <div>
                {ui("total", lang)}
                <strong>{rupees(o.total)}</strong>
              </div>
              <div>
                {ui("shipTo", lang)}
                <strong>{STORE_ADDRESS.short[lang]}</strong>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span id={`o-${o.id}`}>
                  {ui("orderNumber", lang)} #<strong style={{ display: "inline" }}>{o.id}</strong>
                </span>
              </div>
            </div>
            <div className="s-order-body">
              <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>{status}</h2>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {o.lines.map((l) => {
                  const p = getProduct(l.id);
                  if (!p) return null;
                  return (
                    <li key={l.id} className="s-cartitem" style={{ gridTemplateColumns: "5rem minmax(0,1fr)" }}>
                      <Image src={p.photo} alt="" width={80} height={80} unoptimized />
                      <div>
                        <Link href={`/product/${p.id}`}>{p.name[lang]}</Link>
                        <p className="s-delivery" style={{ margin: 0 }}>
                          {ui("qtyLabel", lang)}: {l.qty}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {tracked === o.id && (
                <p role="status" className="s-ok">
                  {ui("orderNumber", lang)} {o.id}: {status}
                </p>
              )}
              {i === 0 && (
                <div className="s-actions">
                  <button type="button" className="s-btn" onClick={() => setTracked(o.id)}>
                    {ui("track", lang)}
                  </button>
                  {o.status !== "return" && (
                    <button type="button" className="s-btn plain" onClick={() => void shop.returnOrder()}>
                      {ui("returnOrder", lang)}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
