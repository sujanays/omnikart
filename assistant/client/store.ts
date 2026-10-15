"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/contract/lang";
import { isLang } from "@/contract/lang";
import type { StoreMeta } from "@/contract";
import type { CartLine, Ctx, Order } from "@/assistant/agent/state";
import { initialCtx } from "@/assistant/agent/state";
import type { Line } from "@/assistant/agent/templates";
import { initialSignals, type Offer, type SignalState } from "@/assistant/signals";

export interface Prefs {
  speed: number;
  textScale: number;
  calm: boolean;
  oneKey: boolean;
  contrast: boolean;
  /** voice off; replies go to the live region for a screen reader */
  screenReader: boolean;
}

export interface Faults {
  network: boolean;
  asr_garble: boolean;
  groq_429: boolean;
  tts_fail: boolean;
}

export type Status = "idle" | "listening" | "thinking" | "speaking";

export interface LogEntry {
  id: number;
  t: number;
  text: string;
}

export interface AppState {
  /* ---- saved in this browser ---- */
  lang: Lang;
  /** null: reply in the language the shopper speaks */
  outLang: Lang | null;
  cart: CartLine[];
  orders: Order[];
  prefs: Prefs;
  declined: string[];
  faults: Faults;
  /* ---- this visit only ---- */
  hydrated: boolean;
  /** what the store sells; null until the store has answered */
  meta: StoreMeta | null;
  ctx: Ctx;
  status: Status;
  heard: string;
  lines: Line[];
  activeLine: number;
  lastLines: Line[];
  log: LogEntry[];
  pendingOffer: Offer | null;
  pendingConfirm: string | null;
  failures: number;
  signals: SignalState;
  scanIndex: number;
  /** connection lost: the last request is queued and will be retried */
  offline: boolean;
  /** show the big phrase buttons (after repeated misrecognition or a blocked microphone) */
  showPhrases: boolean;
  /** the Omnikart guide panel is open */
  dockOpen: boolean;
  /** Focus view: the store is hidden and only Omnikart's words are shown, large */
  focusView: boolean;
}

export const DEFAULT_PREFS: Prefs = { speed: 1, textScale: 1, calm: false, oneKey: false, contrast: false, screenReader: false };
export const NO_FAULTS: Faults = { network: false, asr_garble: false, groq_429: false, tts_fail: false };

export function initialState(): AppState {
  return {
    lang: "en",
    outLang: null,
    cart: [],
    orders: [],
    prefs: { ...DEFAULT_PREFS },
    declined: [],
    faults: { ...NO_FAULTS },
    hydrated: false,
    meta: null,
    ctx: initialCtx(),
    status: "idle",
    heard: "",
    lines: [],
    activeLine: -1,
    lastLines: [],
    log: [],
    pendingOffer: null,
    pendingConfirm: null,
    failures: 0,
    signals: initialSignals(),
    scanIndex: 0,
    offline: false,
    showPhrases: false,
    dockOpen: true,
    focusView: false,
  };
}

const KEY = "omnikart:v1";
const PERSISTED = ["lang", "outLang", "cart", "orders", "prefs", "declined", "faults"] as const;

function safeRead(): Partial<AppState> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<AppState> = {};
    if (isLang(p.lang)) out.lang = p.lang;
    if (p.outLang === null || isLang(p.outLang)) out.outLang = p.outLang as Lang | null;
    if (Array.isArray(p.cart)) out.cart = p.cart as CartLine[];
    if (Array.isArray(p.orders)) out.orders = p.orders as Order[];
    if (p.prefs && typeof p.prefs === "object") out.prefs = { ...DEFAULT_PREFS, ...(p.prefs as Partial<Prefs>) };
    if (Array.isArray(p.declined)) out.declined = p.declined.filter((x): x is string => typeof x === "string");
    if (p.faults && typeof p.faults === "object") out.faults = { ...NO_FAULTS, ...(p.faults as Partial<Faults>) };
    return out;
  } catch {
    return {};
  }
}

function safeWrite(s: AppState): void {
  try {
    const data: Record<string, unknown> = {};
    for (const k of PERSISTED) data[k] = s[k];
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private window or storage blocked: the page works without it */
  }
}

type Listener = () => void;

class Store {
  private state: AppState = initialState();
  private server: AppState = initialState();
  private listeners = new Set<Listener>();
  private logId = 0;

  get = (): AppState => this.state;
  getServer = (): AppState => this.server;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void => {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    const changedSaved = PERSISTED.some((k) => k in p && p[k] !== this.state[k]);
    this.state = { ...this.state, ...p };
    if (changedSaved && typeof window !== "undefined") safeWrite(this.state);
    this.listeners.forEach((l) => l());
  };

  /** Load saved data once, after the first render, so server and browser render the same first frame. */
  hydrate = (): void => {
    if (this.state.hydrated) return;
    this.set({ ...safeRead(), hydrated: true });
  };

  log = (text: string): void => {
    const entry: LogEntry = { id: ++this.logId, t: Date.now(), text };
    this.set((s) => ({ log: [...s.log.slice(-199), entry] }));
  };
}

export const store = new Store();

export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/** The language we speak back. */
export function outLangOf(s: Pick<AppState, "lang" | "outLang">): Lang {
  return s.outLang ?? s.lang;
}
