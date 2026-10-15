"use client";

import { useEffect } from "react";
import { useApp, store } from "@/assistant/client/store";
import { ui } from "@/assistant/client/ui-text";
import { useEngine } from "@/assistant/components/AssistantProvider";

/**
 * Focus view: the store is hidden and only what Omnikart is saying is shown, large.
 * This is the "raw against accessible" contrast live, on any page.
 */
export function FocusView() {
  const engine = useEngine();
  const { focusView, lines, activeLine, status, heard, lang } = useApp();

  // everything behind it stops being reachable by keyboard and screen reader while it is open
  useEffect(() => {
    const store_ = document.querySelector(".store");
    if (!store_) return;
    if (focusView) store_.setAttribute("inert", "");
    else store_.removeAttribute("inert");
    return () => store_.removeAttribute("inert");
  }, [focusView]);

  if (!focusView) return null;
  const statusText =
    status === "listening" ? ui("talkListening", lang) : status === "thinking" ? ui("talkThinking", lang) : status === "speaking" ? ui("talkSpeaking", lang) : ui("talkIdle", lang);
  return (
    <section className="focus-view" aria-label={ui("focusView", lang)}>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => store.set({ focusView: false })}>
          {ui("focusBack", lang)}
        </button>
      </div>
      <div className="words" role="region" aria-live="polite" tabIndex={0} aria-label={ui("captions", lang)}>
        {heard && (
          <p className="muted">
            {ui("youSaid", lang)}: {heard}
          </p>
        )}
        {lines.map((l, i) => (
          <p key={`${i}-${l.caption}`} data-speaking={status === "speaking" && i === activeLine ? "true" : undefined} style={{ whiteSpace: "pre-line" }}>
            {l.caption}
          </p>
        ))}
        {lines.length === 0 && <p>{ui("dockWelcome", lang)}</p>}
      </div>
      <button data-talk data-status={status} className="talk" type="button" onClick={() => void engine.talk()}>
        {statusText}
      </button>
    </section>
  );
}
