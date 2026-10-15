"use client";

import { useApp } from "@/assistant/client/store";
import { ui } from "@/assistant/client/ui-text";

/**
 * Every step and every decision, in plain words, so judges and helpers can see why Omnikart did what it did.
 * Example: "Chose action search using the AI, key 4 of 10" and "Cart total computed by code from catalogue prices".
 */
export function DecisionLog({ limit = 60 }: { limit?: number }) {
  const { log, lang } = useApp();
  if (log.length === 0) return <p className="muted">{ui("logEmpty", lang)}</p>;
  const shown = log.slice(-limit);
  return (
    <ol className="log" tabIndex={0} aria-label={ui("decisionLog", lang)}>
      {shown.map((e) => (
        <li key={e.id}>
          <time dateTime={new Date(e.t).toISOString()}>{new Date(e.t).toLocaleTimeString([], { hour12: false })}</time>
          {e.text}
        </li>
      ))}
    </ol>
  );
}
