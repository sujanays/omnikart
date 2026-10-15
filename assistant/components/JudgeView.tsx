"use client";

import { useEffect, useState } from "react";
import type { ProductDTO, ReviewDTO } from "@/contract";
import { HttpStoreAdapter } from "@/assistant/adapter/http";
import { emptyAction } from "@/assistant/agent/schema";
import { LANGS, LANG_NATIVE_NAME } from "@/contract/lang";
import { callApi } from "@/assistant/client/api";
import { NO_FAULTS, store, useApp, type Faults, type Prefs } from "@/assistant/client/store";
import { THRESHOLDS } from "@/assistant/signals";
import { useEngine } from "@/assistant/components/AssistantProvider";
import { DecisionLog } from "@/assistant/components/DecisionLog";

interface Health {
  deep: boolean;
  configured: number;
  of: number;
  mockLlm: boolean;
  faultsAllowed: boolean;
  services: { name: string; total: number; healthy: number; resting: number; issue?: string; ok?: boolean; ms?: number; error?: string }[];
}

const FAULT_INFO: { key: keyof Faults; label: string; what: string }[] = [
  { key: "network", label: "Cut the network", what: "Every request fails as if you were offline. Omnikart says so, queues your request, and retries when you switch this off." },
  { key: "asr_garble", label: "Garble speech recognition", what: "The recogniser hears 'ten'. Omnikart must ask 'I heard ten. Is that right?' and never act on it." },
  { key: "groq_429", label: "Rate limit the AI on every key", what: "All Groq keys answer 429. Omnikart falls back to its keyword matcher and keeps working." },
  { key: "tts_fail", label: "Break text to speech", what: "Live voice fails. Omnikart uses saved audio, then the browser's voice, and captions stay on." },
];

const PREF_TOGGLES: { key: keyof Pick<Prefs, "calm" | "oneKey" | "contrast" | "screenReader">; label: string }[] = [
  { key: "calm", label: "Calm mode (ageing)" },
  { key: "oneKey", label: "One key mode (hand-motor)" },
  { key: "contrast", label: "High contrast (low vision)" },
  { key: "screenReader", label: "Screen reader mode" },
];

export function JudgeView() {
  const engine = useEngine();
  const app = useApp();
  const { lang, faults, signals, prefs, declined } = app;
  const [adapter] = useState(() => new HttpStoreAdapter({ baseUrl: process.env.NEXT_PUBLIC_STORE_BASE_URL ?? "" }));
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);
  const [id, setId] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const p = products.find((x) => x.id === id);

  // the store's products, from the store's own API
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const meta = await adapter.meta();
        const all = (await Promise.all(meta.categories.map((c) => adapter.search({ category: c.id, filters: { sel: {} } })))).flatMap((r) => r.items);
        if (!alive) return;
        setProducts(all);
        setId((cur) => cur || all[0]?.id || "");
      } catch {
        /* the store did not answer: the page says so below */
      }
    })();
    return () => {
      alive = false;
    };
  }, [adapter]);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void adapter.getReviews(id).then((r) => alive && setReviews(r)).catch(() => alive && setReviews([]));
    return () => {
      alive = false;
    };
  }, [adapter, id]);

  const refreshHealth = async (deep: boolean) => {
    setChecking(true);
    try {
      setHealth(await callApi<Health>(`/api/health${deep ? "?deep=1" : ""}`, { method: "GET" }, NO_FAULTS));
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    let alive = true;
    callApi<Health>("/api/health", { method: "GET" }, NO_FAULTS)
      .then((h) => alive && setHealth(h))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const play = (name: Parameters<typeof emptyAction>[0]) => () => void engine.perform(emptyAction(name), { productId: id });

  return (
    <>
      <h1>Judge view</h1>
      <p>Everything a judge needs to see in one place: raw against accessible, the decision log, the failure switches, and what Omnikart has noticed.</p>

      <section aria-labelledby="sbs">
        <h2 id="sbs">1. Raw output next to accessible output</h2>
        <div className="row">
          <label htmlFor="judge-product">
            <strong>Product</strong>
          </label>
          <select id="judge-product" className="btn" value={id} onChange={(e) => setId(e.target.value)}>
            {products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name.en}
              </option>
            ))}
          </select>
          <span className="muted">Language of the accessible side: {LANG_NATIVE_NAME[lang]}</span>
        </div>
        {!p ? (
          <p role="status">Loading the products from the store…</p>
        ) : (
        <div className="two-col" style={{ marginTop: "1rem" }}>
          <div className="panel" aria-labelledby="raw-h">
            <h3 id="raw-h">Raw: what a normal product page gives a shopper</h3>
            <table>
              <caption className="sr-only">Raw specification table</caption>
              <tbody>
                {p.specs.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">{s.label.en}</th>
                    <td>{s.value.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>All {reviews.length} written reviews, as they are</h4>
            <ul className="reviews" tabIndex={0} aria-label={`All ${reviews.length} written reviews`} style={{ maxHeight: "22rem", overflow: "auto" }}>
              {reviews.map((r) => (
                <li key={r.id}>
                  {r.stars}★ {r.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel" aria-labelledby="acc-h">
            <h3 id="acc-h">Accessible: what Omnikart says</h3>
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              <button type="button" className="btn" onClick={play("reviews")}>
                Play the review summary
              </button>
              <button type="button" className="btn" onClick={play("top_facts")}>
                Play key facts
              </button>
              <button type="button" className="btn" onClick={play("explain_simpler")}>
                Play simple words
              </button>
              <button type="button" className="btn" onClick={play("describe_photo")}>
                Play photo description
              </button>
              {p.sizes && (
                <button type="button" className="btn" onClick={play("size_help")}>
                  Play size chart
                </button>
              )}
            </div>
            <h4>Top things to know</h4>
            <ul>
              {p.topFacts[lang].map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <h4>In simple words</h4>
            <ul>
              {p.simpleFacts[lang].map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <h4>
              Based on {p.reviewSummary.count} written reviews (counted by the store with plain code, no AI)
            </h4>
            <ul>
              <li>Liked: {p.reviewSummary.pros[lang].join(", ") || "-"}</li>
              <li>Did not like: {p.reviewSummary.cons[lang].join(", ") || "-"}</li>
              <li>Verdict: {p.reviewSummary.verdict}</li>
            </ul>
            <h4>The photo, in words</h4>
            <p>{p.look[lang]}</p>
          </div>
        </div>
        )}
      </section>

      <section aria-labelledby="log-h">
        <h2 id="log-h">2. Decision log</h2>
        <p className="muted">Every step. Prices, ratings and dates are read from the catalogue by code, never written by the AI.</p>
        <div className="panel">
          <DecisionLog limit={200} />
        </div>
      </section>

      <section aria-labelledby="fault-h">
        <h2 id="fault-h">3. Make it fail on purpose</h2>
        <div className="panel">
          {FAULT_INFO.map((f) => (
            <label key={f.key} className="check">
              <input type="checkbox" checked={faults[f.key]} onChange={(e) => store.set((s) => ({ faults: { ...s.faults, [f.key]: e.target.checked } }))} />
              <span>
                <strong>{f.label}.</strong> {f.what}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="sig-h">
        <h2 id="sig-h">4. What Omnikart has noticed</h2>
        <p className="muted">It never asks what disability you have. It counts signals and offers one change, once.</p>
        <div className="two-col">
          <div className="panel">
            <h3>Signals so far</h3>
            <table>
              <tbody>
                <tr><th scope="row">Recent mis-taps (offer at {THRESHOLDS.misses} within 10 seconds)</th><td>{signals.missTimes.length}</td></tr>
                <tr><th scope="row">Long presses (offer at {THRESHOLDS.longPresses})</th><td>{signals.longPresses}</td></tr>
                <tr><th scope="row">Double hits (offer at {THRESHOLDS.doubleHits})</th><td>{signals.doubleHits}</td></tr>
                <tr><th scope="row">&quot;What?&quot;, &quot;repeat&quot;, &quot;slower&quot; (offer at {THRESHOLDS.confused})</th><td>{signals.confused}</td></tr>
                <tr><th scope="row">Long silences (offer at {THRESHOLDS.longPauses})</th><td>{signals.longPauses}</td></tr>
                <tr><th scope="row">Page zoom (offer at {THRESHOLDS.zoom})</th><td>{signals.zoom.toFixed(2)}</td></tr>
                <tr><th scope="row">Offers made this visit</th><td>{signals.offered.join(", ") || "none"}</td></tr>
                <tr><th scope="row">Offers declined earlier</th><td>{declined.join(", ") || "none"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Modes right now</h3>
            {PREF_TOGGLES.map((m) => (
              <label key={m.key} className="check">
                <input type="checkbox" checked={prefs[m.key]} onChange={(e) => store.set((s) => ({ prefs: { ...s.prefs, [m.key]: e.target.checked } }))} />
                <span>{m.label}</span>
              </label>
            ))}
            <p className="muted">When modes combine, the stricter setting wins: slowest voice, largest text, longest wait.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="health-h">
        <h2 id="health-h">5. Services and keys</h2>
        <div className="row">
          <button type="button" className="btn" disabled={checking} onClick={() => void refreshHealth(false)}>
            Refresh
          </button>
          <button type="button" className="btn btn-primary" disabled={checking} onClick={() => void refreshHealth(true)}>
            {checking ? "Checking…" : "Check every service now (uses a little quota)"}
          </button>
        </div>
        {health && (
          <div className="panel" style={{ marginTop: "0.75rem" }}>
            <p>
              {health.configured} of {health.of} services configured. AI switched {health.mockLlm ? "off (MOCK_LLM)" : "on"}. Fault switches {health.faultsAllowed ? "allowed" : "disabled"}.
            </p>
            <table>
              <caption className="sr-only">Service status</caption>
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Keys healthy</th>
                  <th scope="col">Live check</th>
                </tr>
              </thead>
              <tbody>
                {health.services.map((s) => (
                  <tr key={s.name}>
                    <th scope="row">{s.name}</th>
                    <td>
                      {s.total === 0 ? "not configured" : `${s.healthy} of ${s.total}${s.resting ? ` (${s.resting} resting)` : ""}`}
                      {s.issue ? ` – ${s.issue}` : ""}
                    </td>
                    <td>{s.ok === undefined ? "-" : <span className="pill" data-ok={s.ok}>{s.ok ? `${s.ms} ms` : s.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">Languages available: {LANGS.map((l) => LANG_NATIVE_NAME[l]).join(", ")}.</p>
      </section>
    </>
  );
}
