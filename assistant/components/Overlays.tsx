"use client";

import { useEngine } from "@/assistant/components/AssistantProvider";
import { useApp } from "@/assistant/client/store";
import { ui } from "@/assistant/client/ui-text";

/**
 * Calm mode: one large fact at a time (price, then delivery, then rating), with "1 / 3".
 * The card stays on screen after the voice moves on, until the shopper asks for something else.
 */
export function CalmCard() {
  const { prefs, lines, activeLine, status } = useApp();
  if (!prefs.calm || status === "listening") return null;
  let card = undefined as (typeof lines)[number]["card"];
  for (let i = Math.min(activeLine, lines.length - 1); i >= 0 && !card; i--) card = lines[i].card;
  if (!card) card = [...lines].reverse().find((l) => l.card)?.card;
  if (!card) return null;
  return (
    <section className="calm-card" aria-hidden="true">
      <div>
        <p className="step">
          {card.step} / {card.of}
        </p>
        <p className="title">{card.title}</p>
        <p className="value">{card.value}</p>
      </div>
    </section>
  );
}

/** One key mode: shows the choice being read right now. */
export function ScanBanner() {
  const engine = useEngine();
  const { prefs, scanIndex, lang } = useApp();
  if (!prefs.oneKey) return null;
  const choice = engine.currentChoices()[scanIndex];
  return (
    <div className="scan-banner" role="status">
      <small>{ui("scanNow", lang)}</small>
      {choice ? choice.label : "…"}
    </div>
  );
}
