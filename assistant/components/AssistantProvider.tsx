"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Engine } from "@/assistant/client/engine";
import { useApp } from "@/assistant/client/store";
import { effectiveModes } from "@/assistant/signals";
import { FLASH_EVENT } from "@/assistant/client/chime";
import { LANG_TAG } from "@/contract/lang";
import { ui } from "@/assistant/client/ui-text";

const EngineContext = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const e = useContext(EngineContext);
  if (!e) throw new Error("useEngine must be used inside AssistantProvider");
  return e;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new Engine());
  const app = useApp();

  useEffect(() => {
    engine.init();
    return () => engine.destroy();
  }, [engine]);

  // text size, contrast, calm mode, the page language and whether the guide is docked
  const { prefs, lang, dockOpen } = app;
  useEffect(() => {
    const m = effectiveModes(prefs);
    const root = document.documentElement;
    root.style.setProperty("--scale", String(m.textScale));
    root.dataset.theme = prefs.contrast ? "contrast" : "light";
    root.dataset.calm = String(prefs.calm);
    root.dataset.onekey = String(prefs.oneKey);
    root.lang = LANG_TAG[lang];
    document.body.dataset.dock = dockOpen ? "open" : "closed";
  }, [prefs, lang, dockOpen]);

  // one key mode: rebuild the list of choices whenever where we are or what we hold changes
  const { ctx, cart, outLang } = app;
  const readbackDone = ctx.checkout?.readbackDone ?? false;
  const optionsKey = ctx.options.join(",");
  useEffect(() => {
    engine.refreshScan();
  }, [engine, ctx.screen, optionsKey, ctx.asking, cart.length, lang, outLang, prefs.oneKey, prefs.calm, readbackDone, ctx.productId]);

  // outline the choice being read (the page does the drawing; we only say which element)
  const scanIndex = app.scanIndex;
  useEffect(() => {
    const choice = prefs.oneKey && scanIndex >= 0 ? engine.currentChoices()[scanIndex] : undefined;
    engine.highlight(choice?.domId ?? null, "scan");
  }, [engine, prefs.oneKey, scanIndex, ctx.screen, optionsKey, ctx.asking]);

  // hold the page's Place order button until the summary has been heard to the end
  const lockMessage = ui("reviewFirst", lang);
  useEffect(() => {
    engine.pushLock(lockMessage);
  }, [engine, ctx.screen, readbackDone, lockMessage]);

  // highlight what Omnikart is talking about, with a words tag, so a sighted helper can follow
  const activeFocus = app.status === "speaking" ? app.lines[app.activeLine]?.focus : undefined;
  const readingLabel = ui("omnikartReading", lang);
  useEffect(() => {
    engine.highlight(activeFocus ?? null, "reading", readingLabel);
  }, [engine, activeFocus, readingLabel]);

  return (
    <EngineContext.Provider value={engine}>
      {children}
    </EngineContext.Provider>
  );
}

/** The screen edge flashes with every sound, so nothing depends on hearing alone. */
export function FlashEdge() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      setOn(true);
      clearTimeout(t);
      t = setTimeout(() => setOn(false), 350);
    };
    window.addEventListener(FLASH_EVENT, handler);
    return () => {
      window.removeEventListener(FLASH_EVENT, handler);
      clearTimeout(t);
    };
  }, []);
  return <div className="flash" data-on={on} aria-hidden="true" />;
}
