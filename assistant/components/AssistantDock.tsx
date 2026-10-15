"use client";

import { useState, type FormEvent } from "react";
import { LANGS, LANG_NATIVE_NAME, type Lang } from "@/contract/lang";
import { emptyAction } from "@/assistant/agent/schema";
import type { FlowStep } from "@/assistant/agent/state";
import { facetById } from "@/assistant/content/facets";
import { SCAN_LABEL } from "@/assistant/client/scan";
import { outLangOf, store, useApp, type Prefs } from "@/assistant/client/store";
import { ui, type UiKey } from "@/assistant/client/ui-text";
import { useEngine } from "@/assistant/components/AssistantProvider";
import { DecisionLog } from "@/assistant/components/DecisionLog";

function setPrefs(patch: Partial<Prefs>) {
  store.set((s) => ({ prefs: { ...s.prefs, ...patch } }));
}

const STEPS: { id: FlowStep; label: UiKey }[] = [
  { id: "ask", label: "stepAsk" },
  { id: "filters", label: "stepFilters" },
  { id: "matches", label: "stepMatches" },
  { id: "reviews", label: "stepReviews" },
  { id: "delivery", label: "stepDelivery" },
  { id: "order", label: "stepOrder" },
];

/** The six steps of the journey. Shown in words and numbers, never by colour alone. */
function StepTracker() {
  const { ctx, lang } = useApp();
  const cur = STEPS.findIndex((s) => s.id === ctx.step);
  return (
    <ol className="steps" aria-label={ui("stepsLabel", lang)}>
      {STEPS.map((s, i) => (
        <li key={s.id} data-state={i < cur ? "done" : i === cur ? "current" : "todo"} aria-current={i === cur ? "step" : undefined}>
          {ui(s.label, lang)}
          <span className="sr-only">{i < cur ? " (done)" : i === cur ? " (now)" : ""}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Omnikart, the guide. It sits on top of the store, in its own colours, and reads and sets the same
 * filters the store's sidebar shows. Everything it can do with a voice, a button or a key does the same thing.
 */
export function AssistantDock() {
  const engine = useEngine();
  const app = useApp();
  const { lang, status, heard, lines, activeLine, prefs, offline, showPhrases, ctx, dockOpen } = app;
  const [typed, setTyped] = useState("");

  const statusText =
    status === "listening" ? ui("talkListening", lang) : status === "thinking" ? ui("talkThinking", lang) : status === "speaking" ? ui("talkSpeaking", lang) : ui("talkIdle", lang);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    void engine.submitText(text);
  };

  const categories = app.meta?.categories ?? [];
  const facet = ctx.category ? facetById(categories.find((c) => c.id === ctx.category)?.facets ?? [], ctx.asking) : undefined;

  if (!dockOpen) {
    return (
      <aside className="dock" data-open="false" aria-label={ui("dockTitle", lang)}>
        <button type="button" className="btn btn-primary" onClick={() => store.set({ dockOpen: true })}>
          {ui("openDock", lang)}
        </button>
      </aside>
    );
  }

  return (
    <aside className="dock" data-open="true" aria-label={ui("dockTitle", lang)} data-testid="dock">
      <div className="dock-head">
        <span className="dock-mark" aria-hidden="true">
          O
        </span>
        <h2>{ui("dockTitle", lang)}</h2>
        <button type="button" className="btn" onClick={() => store.set({ focusView: true })}>
          {ui("focusView", lang)}
        </button>
        <button type="button" className="btn" onClick={() => store.set({ dockOpen: false })}>
          {ui("closeDock", lang)}
        </button>
      </div>

      <div className="dock-body">
        <StepTracker />

        {offline && (
          <div className="offline-banner" role="alert">
            {ui("offline", lang)}
          </div>
        )}

        {!ctx.introduced && lines.length === 0 && (
          <section className="welcome" aria-label={ui("dockWelcome", lang)}>
            <p>{ui("dockWelcome", lang)}</p>
            <p>
              <strong>{ui("startHint", lang)}</strong>
            </p>
          </section>
        )}

        <button id="talk-button" data-talk data-status={status} className="talk" type="button" onClick={() => void engine.talk()} aria-label={statusText}>
          {statusText}
        </button>
        {status === "speaking" && (
          <button type="button" className="btn" onClick={() => engine.stopSpeaking()}>
            {ui("stop", lang)}
          </button>
        )}

        {/* at the checkout: hear the summary (the page's Place order button waits for it) */}
        {ctx.screen === "checkout" && (
          <div role="group" aria-label={ui("stepOrder", lang)} className="chips">
            <button type="button" className="btn btn-primary" onClick={() => void engine.perform({ ...emptyAction("checkout"), payment: ctx.checkout?.payment ?? null })}>
              {ctx.checkout?.readbackDone ? ui("hearAgain", lang) : ui("hearSummary", lang)}
            </button>
            <p className="muted" aria-live="polite">
              {ctx.checkout?.readbackDone ? ui("placeReady", lang) : ui("reviewFirst", lang)}
            </p>
          </div>
        )}

        <div className="captions" role="region" tabIndex={0} aria-label={ui("captions", lang)} aria-live={prefs.screenReader ? "polite" : "off"} aria-atomic="false">
          {heard && (
            <p className="heard">
              <strong>{ui("youSaid", lang)}:</strong> <span>{heard}</span>
            </p>
          )}
          {lines.map((l, i) => (
            <p key={`${i}-${l.caption}`} className="caption-line" data-speaking={status === "speaking" && i === activeLine ? "true" : undefined}>
              {l.caption}
            </p>
          ))}
        </div>

        {/* the open question's options as buttons, for anyone who prefers to tap */}
        {facet && (
          <div role="group" aria-label={facet.title[lang]} className="chips">
            {facet.kind === "size" ? null : (facet.askOptions ?? facet.options.map((o) => o.id)).map((id) => {
              const o = facet.options.find((x) => x.id === id)!;
              return (
                <button key={id} type="button" className="btn" onClick={() => void engine.answerOptionChoice(facet.id, id)}>
                  {facet.kind === "bool" ? { en: "Yes", hi: "हाँ", te: "అవును" }[lang] : o.label[lang]}
                </button>
              );
            })}
            <button type="button" className="btn" onClick={() => void engine.perform(emptyAction("skip_filter"))}>
              {SCAN_LABEL.skip[lang]}
            </button>
          </div>
        )}

        {(showPhrases || (!ctx.introduced && lines.length === 0)) && (
          <div role="group" aria-label={ui("quickStart", lang)} className="chips">
            {categories.map((c) => (
              <button key={c.id} type="button" className="btn" onClick={() => void engine.perform({ ...emptyAction("search"), category: c.id })}>
                {c.name[lang]}
              </button>
            ))}
          </div>
        )}

        <form className="type-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="type-input">
            {ui("typeLabel", lang)}
          </label>
          <input id="type-input" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={ui("typeLabel", lang)} />
          <button className="btn" type="submit">
            {ui("send", lang)}
          </button>
        </form>

        <details>
          <summary>{ui("settings", lang)}</summary>
          <div className="settings">
            <div className="field" role="group" aria-label={ui("language", lang)}>
              <strong>{ui("language", lang)}</strong>
              <div className="row">
                {LANGS.map((l) => (
                  <button key={l} type="button" lang={l} className="btn" aria-pressed={lang === l} onClick={() => void engine.setLanguage(l)}>
                    {LANG_NATIVE_NAME[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="reply-lang">
                <strong>{ui("replyLanguage", lang)}</strong>
              </label>
              <select id="reply-lang" value={app.outLang ?? ""} onChange={(e) => store.set({ outLang: e.target.value === "" ? null : (e.target.value as Lang) })}>
                <option value="">{ui("sameAsSpeech", lang)}</option>
                {LANGS.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LANG_NATIVE_NAME[l]}
                  </option>
                ))}
              </select>
              <span className="muted" aria-hidden="true">
                {LANG_NATIVE_NAME[outLangOf(app)]}
              </span>
            </div>
            <div className="field">
              <label htmlFor="speed">
                <strong>{ui("speechSpeed", lang)}</strong>: {prefs.speed.toFixed(2)}
              </label>
              <input id="speed" type="range" min={0.6} max={1.4} step={0.05} value={prefs.speed} onChange={(e) => setPrefs({ speed: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="textsize">
                <strong>{ui("textSize", lang)}</strong>: {Math.round(prefs.textScale * 100)}%
              </label>
              <input id="textsize" type="range" min={1} max={2} step={0.05} value={prefs.textScale} onChange={(e) => setPrefs({ textScale: Number(e.target.value) })} />
            </div>
            {(["calm", "oneKey", "contrast", "screenReader"] as const).map((key) => (
              <label key={key} className="check">
                <input type="checkbox" checked={prefs[key]} onChange={(e) => setPrefs({ [key]: e.target.checked })} />
                <span>{ui(key, lang)}</span>
              </label>
            ))}
          </div>
        </details>

        <p>
          <a href="/judge">{ui("navJudge", lang)}</a>
        </p>

        <details>
          <summary>{ui("decisionLog", lang)}</summary>
          <DecisionLog />
        </details>
      </div>
    </aside>
  );
}
