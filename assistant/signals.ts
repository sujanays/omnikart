/**
 * Noticing, not asking. Omnikart never asks "what disability do you have" and never labels anyone.
 * It counts a few signals and, when they add up, OFFERS one change, once. The shopper can say no.
 *
 *   hand-motor   3 taps that miss a button within 10 s, or 2 long presses, or 2 double hits
 *   ageing       "what?", "repeat" or "slower" twice, or two long silences
 *   low vision   browser zoom of 150% or more, or a high contrast preference
 *
 * (The blind shopper needs no offer: voice first is the default.)
 */

export type Offer = "motor" | "calm" | "contrast";

export interface SignalState {
  missTimes: number[];
  longPresses: number;
  doubleHits: number;
  confused: number;
  longPauses: number;
  zoom: number;
  contrastMore: boolean;
  /** offers already made this session (made once, never repeated) */
  offered: Offer[];
}

export type SignalEvent =
  | { type: "miss"; t: number }
  | { type: "longpress" }
  | { type: "doublehit" }
  | { type: "confused" }
  | { type: "pause" }
  | { type: "env"; zoom: number; contrastMore: boolean }
  | { type: "offered"; offer: Offer };

export const THRESHOLDS = {
  misses: 3,
  missWindowMs: 10_000,
  longPresses: 2,
  doubleHits: 2,
  confused: 2,
  longPauses: 2,
  zoom: 1.5,
  longPressMs: 600,
  doubleHitMs: 300,
} as const;

export function initialSignals(): SignalState {
  return { missTimes: [], longPresses: 0, doubleHits: 0, confused: 0, longPauses: 0, zoom: 1, contrastMore: false, offered: [] };
}

export function reduceSignal(s: SignalState, e: SignalEvent): SignalState {
  switch (e.type) {
    case "miss":
      return { ...s, missTimes: [...s.missTimes.filter((t) => e.t - t <= THRESHOLDS.missWindowMs), e.t] };
    case "longpress":
      return { ...s, longPresses: s.longPresses + 1 };
    case "doublehit":
      return { ...s, doubleHits: s.doubleHits + 1 };
    case "confused":
      return { ...s, confused: s.confused + 1 };
    case "pause":
      return { ...s, longPauses: s.longPauses + 1 };
    case "env":
      return { ...s, zoom: e.zoom, contrastMore: e.contrastMore };
    case "offered":
      return s.offered.includes(e.offer) ? s : { ...s, offered: [...s.offered, e.offer] };
  }
}

export interface CurrentModes {
  oneKey: boolean;
  calm: boolean;
  contrast: boolean;
}

/**
 * The one offer to make now, or null. Never an offer that is already on, was already made,
 * or was declined earlier (declined offers are remembered across sessions).
 */
export function offerFor(s: SignalState, declined: readonly string[], modes: CurrentModes, now: number = Date.now()): Offer | null {
  const blocked = (o: Offer) => s.offered.includes(o) || declined.includes(o);
  const recentMisses = s.missTimes.filter((t) => now - t <= THRESHOLDS.missWindowMs).length;
  if (!modes.oneKey && !blocked("motor") && (recentMisses >= THRESHOLDS.misses || s.longPresses >= THRESHOLDS.longPresses || s.doubleHits >= THRESHOLDS.doubleHits)) {
    return "motor";
  }
  if (!modes.calm && !blocked("calm") && (s.confused >= THRESHOLDS.confused || s.longPauses >= THRESHOLDS.longPauses)) {
    return "calm";
  }
  if (!modes.contrast && !blocked("contrast") && (s.zoom >= THRESHOLDS.zoom || s.contrastMore)) {
    return "contrast";
  }
  return null;
}

/** Stricter setting wins when conditions combine. */
export interface EffectiveModes {
  speed: number;
  textScale: number;
  silenceMs: number;
  maxWords: number;
  scanMs: number;
}

export function effectiveModes(p: { speed: number; textScale: number; calm: boolean; contrast: boolean; oneKey: boolean }): EffectiveModes {
  return {
    speed: p.calm ? Math.min(p.speed, 0.8) : p.speed,
    textScale: p.calm ? Math.max(p.textScale, 1.5) : p.contrast ? Math.max(p.textScale, 1.25) : p.textScale,
    silenceMs: p.calm ? 3500 : 2000,
    maxWords: p.calm ? 15 : 25,
    scanMs: p.calm ? 3000 : 1500,
  };
}
