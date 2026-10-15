import type { L3, Lang } from "@/contract/lang";
import { UI_EVENT, type CheckoutLockDetail, type FiltersDetail, type HighlightDetail, type LanguageDetail, type MarkDetail, type NavigateDetail, type PageDetail, type PaymentDetail, type StoreAdapter, type StoreMeta } from "@/contract";
import { HttpStoreAdapter } from "@/assistant/adapter/http";
import { VOICEPACK_MANIFEST } from "@/assistant/config";
import { emptyAction, type Action } from "@/assistant/agent/schema";
import { execute, doStartOver } from "@/assistant/agent/executor";
import { answerFacetText, answerOption as flowAnswerOption, continueFlow } from "@/assistant/agent/flow";
import { emptyFilters } from "@/assistant/content/facets";
import { handleCheckoutUtterance, placeOrderByButton } from "@/assistant/agent/checkout";
import { formatDate, languageChangedText, line, plain, spelled, T, type Line } from "@/assistant/agent/templates";
import type { Outcome, Snapshot } from "@/assistant/agent/state";
import { cartLinesCount } from "@/assistant/agent/state";
import { detectLanguageCommand, matchCommand, tokenize, type Cmd, type LangCommand } from "@/assistant/lexicon";
import { normalizeDigits, numbersPreserved } from "@/assistant/speakable";
import { THRESHOLDS, effectiveModes, offerFor, reduceSignal, type Offer, type SignalEvent } from "@/assistant/signals";
import { ClientApiError, callApi } from "@/assistant/client/api";
import { playChime, unlockAudio } from "@/assistant/client/chime";
import { Player } from "@/assistant/client/player";
import { RecorderError, startRecording, type RecordingHandle } from "@/assistant/client/recorder";
import { buildScanChoices, type ScanChoice } from "@/assistant/client/scan";
import { canRewrite, mergeRewrites } from "@/assistant/agent/compose";
import { outLangOf, store } from "@/assistant/client/store";

/**
 * Runs one conversational turn, start to finish:
 *
 *   mic -> ASR -> (fast command | MT to English -> LLM picks an action) -> executor -> speak + captions
 *
 * It owns the microphone, the player and the queue for network drops. React only reads the store
 * and calls the public methods, so there are no stale closures to worry about.
 */

interface AgentResponse {
  action: Action;
  source: "groq" | "keyword" | "mock";
  model?: string;
  reason?: string;
  meta?: { key?: number; keys?: number; rested?: number[] };
}

interface MtResponse {
  text: string;
}
interface AsrResponse {
  text: string;
  meta?: { fault?: string; key?: number; keys?: number };
}
interface AskResponse {
  answer: string;
  found: boolean;
  guarded: boolean;
  source: string;
}

export class Engine {
  private player: Player;
  private rec: RecordingHandle | null = null;
  private turnId = 0;
  private retry: (() => Promise<void>) | null = null;
  private adapter: StoreAdapter;
  private meta: StoreMeta | null = null;
  private readyPromise: Promise<void> | null = null;
  private dirty = true;
  private selfOrdering = false;
  /** the first read of the store has happened (older orders are not news) */
  private synced = false;
  /** when the shopper last left the checkout page (ms); an order placed with the page button lands just after */
  private leftCheckoutAt = 0;
  private names: Record<string, L3> = {};
  private domIds: Record<string, string> = {};
  private unlocked = false;
  private ordering = false;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private scanChoices: ScanChoice[] = [];
  private spaceHandled = false;
  private pressStart = 0;
  private lastClick: { t: number; el: Element | null } = { t: 0, el: null };
  private unsub: (() => void) | null = null;
  private started = false;

  /**
   * The store is reached only through the adapter. By default that is the store's own HTTP API
   * (NEXT_PUBLIC_STORE_BASE_URL, or the same site); tests pass an adapter of their own.
   */
  constructor(adapter?: StoreAdapter) {
    this.adapter =
      adapter ??
      new HttpStoreAdapter({
        baseUrl: process.env.NEXT_PUBLIC_STORE_BASE_URL ?? "",
        guard: () => {
          if (store.get().faults.network || (typeof navigator !== "undefined" && navigator.onLine === false)) throw new ClientApiError("network", 0, "offline");
        },
      });
    this.player = new Player(async (lang, text) => {
      const r = await callApi<{ url: string }>("/api/tts", { json: { lang, text } }, store.get().faults).catch((e) => {
        throw new Error(e instanceof ClientApiError ? e.code : "error");
      });
      return r.url;
    });
  }

  /** Ask the page to go somewhere. The page decides how; we never touch its router. */
  private navigate(url: string): void {
    window.dispatchEvent(new CustomEvent<NavigateDetail>(UI_EVENT.navigate, { detail: { url } }));
  }

  /** Load what the store sells, once. Every turn waits for this. */
  ready(): Promise<void> {
    this.readyPromise ??= this.adapter
      .meta()
      .then(async (m) => {
        this.meta = m;
        store.set({ meta: m });
        await this.syncStore();
      })
      .catch((e) => {
        this.readyPromise = null;
        throw e;
      });
    return this.readyPromise;
  }

  /** The cart and orders belong to the store: read them again. */
  private async syncStore(): Promise<void> {
    const known = new Set(store.get().orders.map((o) => o.id));
    const [cart, orders] = await Promise.all([this.adapter.getCart(), this.adapter.getOrders()]);
    const first = !this.synced;
    this.synced = true;
    this.dirty = false;
    store.set({ cart, orders });
    // an order placed with the page's own button after the summary was heard: say so
    const placed = orders[0];
    const s = store.get();
    const atCheckout = s.ctx.screen === "checkout" || Date.now() - this.leftCheckoutAt < 6000;
    if (!first && placed && !known.has(placed.id) && !this.selfOrdering && atCheckout && this.meta) {
      const lang = outLangOf(s);
      store.set({ ctx: { ...s.ctx, screen: "ordered", checkout: null, lastOrderId: placed.id, options: [], productId: null } });
      void this.speak([line("ordered", { digits: spelled(placed.id), date: formatDate(new Date(placed.placedAt + placed.deliveryDays * 86_400_000), lang) }, lang)]);
    }
  }

  /** Before a turn: the store's meta is loaded and the cart is current. */
  private async prepare(): Promise<void> {
    await this.ready();
    if (this.dirty) await this.syncStore();
  }

  /* ------------------------------------------------------------------ *
   * Start and stop
   * ------------------------------------------------------------------ */

  init(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    store.hydrate();
    void this.loadVoicePack();
    this.updateEnv();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("click", this.onClick, true);
    window.addEventListener("pointerdown", this.onPointerDown, true);
    window.addEventListener("pointerup", this.onPointerUp, true);
    window.addEventListener("online", this.onOnline);
    window.visualViewport?.addEventListener("resize", this.updateEnv);
    window.addEventListener(UI_EVENT.page, this.onPage as EventListener);
    window.addEventListener(UI_EVENT.filtersChanged, this.onFiltersChanged as EventListener);
    window.addEventListener(UI_EVENT.languageChanged, this.onLanguageChanged as EventListener);
    window.addEventListener(UI_EVENT.paymentChanged, this.onPaymentChanged as EventListener);
    window.addEventListener(UI_EVENT.cartChanged, this.onCartChanged);
    void this.ready().catch(() => store.log("The store did not answer yet; will try again on the next turn"));
    this.pushLanguage();
    // A fault switch turned off on the judge page ends the simulated outage.
    this.unsub = store.subscribe(() => {
      const s = store.get();
      if (s.offline && !s.faults.network && navigator.onLine) void this.resume();
    });
  }

  destroy(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("click", this.onClick, true);
    window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("online", this.onOnline);
    window.visualViewport?.removeEventListener("resize", this.updateEnv);
    window.removeEventListener(UI_EVENT.page, this.onPage as EventListener);
    window.removeEventListener(UI_EVENT.filtersChanged, this.onFiltersChanged as EventListener);
    window.removeEventListener(UI_EVENT.languageChanged, this.onLanguageChanged as EventListener);
    window.removeEventListener(UI_EVENT.paymentChanged, this.onPaymentChanged as EventListener);
    window.removeEventListener(UI_EVENT.cartChanged, this.onCartChanged);
    this.unsub?.();
    this.stopScan();
    this.cancelAll();
  }

  private async loadVoicePack(): Promise<void> {
    try {
      const res = await fetch(VOICEPACK_MANIFEST);
      if (!res.ok) return;
      const manifest = (await res.json()) as Record<string, string>;
      this.player.setManifest(manifest);
      store.log(`Voice pack loaded: ${Object.keys(manifest).length} saved audio lines`);
      const lang = outLangOf(store.get());
      const texts = (["err_offline", "back_online", "err_busy", "err_generic", "err_asr_empty", "err_asr_slow", "err_mic", "err_no_speech"] as const).map((id) => T[id][lang]);
      void this.player.warm(lang, texts);
    } catch {
      /* no voice pack yet: every line is spoken live */
    }
  }

  /* ------------------------------------------------------------------ *
   * Speaking
   * ------------------------------------------------------------------ */

  private effective() {
    return effectiveModes(store.get().prefs);
  }

  /** Speak lines with captions. Resolves when done or interrupted. */
  async speak(lines: Line[], opts: { remember?: boolean } = {}): Promise<boolean> {
    if (lines.length === 0) return true;
    const s = store.get();
    const m = this.effective();
    if (opts.remember !== false) store.set({ lastLines: lines });
    store.set({ status: "speaking", lines, activeLine: 0 });
    const readback = lines.some((l) => l.readback);
    const r = await this.player.speak(lines, {
      lang: outLangOf(s),
      speed: m.speed,
      maxWords: m.maxWords,
      voice: !s.prefs.screenReader,
      onLineStart: (_l, i) => store.set({ activeLine: i }),
      onNote: (t) => store.log(t),
    });
    if (r.completed) {
      const cur = store.get();
      store.set({
        status: "idle",
        ...(readback && cur.ctx.checkout ? { ctx: { ...cur.ctx, checkout: { ...cur.ctx.checkout, readbackDone: true } } } : {}),
      });
    }
    return r.completed;
  }

  /** Stop talking right now. Anything half said (like a price read-back) does not count as heard. */
  stopSpeaking(): void {
    this.player.stop();
    if (store.get().status === "speaking") store.set({ status: "idle" });
  }

  /** Escape: stop speaking, drop the recording, forget any answer still on its way. */
  cancelAll(): void {
    this.turnId++;
    this.rec?.cancel();
    this.rec = null;
    this.player.stop();
    store.set({ status: "idle" });
  }

  async repeat(): Promise<void> {
    const s = store.get();
    if (s.lastLines.length === 0) {
      await this.speak([line("repeat_none", {}, outLangOf(s))], { remember: false });
      return;
    }
    if (s.lastLines.some((l) => l.readback) && s.ctx.checkout) {
      store.set({ ctx: { ...s.ctx, checkout: { ...s.ctx.checkout, readbackDone: false } } });
    }
    await this.speak(s.lastLines);
  }

  private begin(): number {
    return ++this.turnId;
  }
  private stale(my: number): boolean {
    return my !== this.turnId;
  }

  /* ------------------------------------------------------------------ *
   * Listening
   * ------------------------------------------------------------------ */

  /** The talk button and the Space key. A second press while listening means "I am done". */
  async talk(): Promise<void> {
    const s = store.get();
    if (s.status === "listening") {
      this.rec?.stop();
      return;
    }
    this.markUnlocked();
    this.stopScan();
    this.player.stop();
    const my = this.begin();
    store.set({ status: "idle" });
    // Step 1 of the journey: on the very first tap Omnikart introduces itself and asks what to buy, then listens.
    if (!store.get().ctx.introduced) {
      store.set((st) => ({ ctx: { ...st.ctx, introduced: true } }));
      store.log("First tap: Omnikart introduces itself and asks what you want to buy, then listens");
      const lang = outLangOf(store.get());
      await this.ready().catch(() => undefined);
      const done = await this.speak([line("intro", { store: this.meta?.name[lang] ?? "" }, lang)], { remember: false });
      if (!done || this.stale(my)) return;
    }
    await this.listen(my);
  }

  private markUnlocked(): void {
    this.unlocked = true;
    this.player.unlock();
    void unlockAudio();
  }

  private async listen(my: number): Promise<void> {
    const lang = outLangOf(store.get());
    try {
      store.set({ status: "listening", heard: "" });
      playChime("listening");
      this.rec = await startRecording({ silenceMs: this.effective().silenceMs });
    } catch (e) {
      store.set({ status: "idle", showPhrases: true });
      store.log(`Microphone problem: ${e instanceof RecorderError ? e.code : "unknown"}`);
      playChime("problem");
      await this.speak([line("err_mic", {}, lang)], { remember: false });
      return;
    }
    const handle = this.rec;
    const res = await handle.result;
    if (this.rec === handle) this.rec = null;
    if (this.stale(my)) return;
    if (res.kind === "none") {
      store.set({ status: "idle" });
      if (res.reason === "no_speech") {
        this.signal({ type: "pause" });
        playChime("problem");
        await this.speak([line("err_no_speech", {}, lang)], { remember: false });
      }
      return;
    }
    playChime("thinking");
    store.set({ status: "thinking" });
    store.log(`Recorded ${res.seconds.toFixed(1)} seconds (${res.reason === "silence" ? "stopped after a pause" : res.reason === "cap" ? "stopped at 15 seconds" : "you tapped again"})`);
    await this.handleAudio(res.wav, my);
  }

  private async handleAudio(wav: Blob, my: number): Promise<void> {
    const s = store.get();
    this.retry = () => this.handleAudio(wav, my);
    try {
      const fd = new FormData();
      fd.append("lang", s.lang);
      fd.append("audio", wav, "speech.wav");
      const r = await callApi<AsrResponse>("/api/asr", { form: fd }, s.faults);
      if (this.stale(my)) return;
      store.set({ failures: 0 });
      if (r.meta?.key) store.log(`Speech recognition used key ${r.meta.key} of ${r.meta.keys}`);
      await this.handleText(r.text, "voice", my, { garbled: r.meta?.fault === "asr_garble" });
    } catch (e) {
      if (this.stale(my)) return;
      await this.fail(e, "asr");
    }
  }

  /* ------------------------------------------------------------------ *
   * Typed input, buttons and scan choices
   * ------------------------------------------------------------------ */

  async submitText(text: string): Promise<void> {
    this.markUnlocked();
    this.stopScan();
    this.player.stop();
    const my = this.begin();
    store.set({ status: "thinking" });
    await this.handleText(text, "typed", my, {});
  }

  /** Run an action directly (a button, a scan choice). No speech recognition and no LLM involved. */
  async perform(action: Action, o: { productId?: string; userText?: string } = {}): Promise<void> {
    this.markUnlocked();
    this.stopScan();
    this.player.stop();
    const my = this.begin();
    if (o.productId) {
      store.set((s) => ({ ctx: { ...s.ctx, options: [o.productId!], productId: null } }));
      action = { ...action, pick: action.pick ?? 1 };
    }
    store.set({ status: "thinking" });
    try {
      await this.prepare();
      const out = await execute(action, this.snap(o.userText ?? ""));
      store.log(`Button or key: ${action.action}`);
      if (!this.stale(my)) await this.apply(out, my);
    } catch (e) {
      if (!this.stale(my)) await this.fail(e, "turn");
    }
  }

  /** The labelled "Place order" button. Same rule as the spoken phrase. */
  async placeOrderButton(): Promise<void> {
    if (this.ordering) return;
    this.ordering = true;
    try {
      this.markUnlocked();
      this.player.stop();
      const my = this.begin();
      await this.prepare();
      this.selfOrdering = true;
      const out = await placeOrderByButton(this.snap());
      await this.apply(out, my);
    } catch (e) {
      await this.fail(e, "turn");
    } finally {
      this.selfOrdering = false;
      this.ordering = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * One turn from text
   * ------------------------------------------------------------------ */

  private snap(userText = ""): Snapshot {
    const s = store.get();
    return { lang: outLangOf(s), inputLang: s.lang, cart: s.cart, ctx: s.ctx, orders: s.orders, calm: s.prefs.calm, now: new Date(), userText, store: this.adapter, meta: this.meta! };
  }

  private lowTrust(text: string): boolean {
    const toks = tokenize(text);
    return toks.length === 0 || (toks.length === 1 && /^\d+$/.test(toks[0])) || text.trim().length < 2;
  }

  private async handleText(raw: string, source: "voice" | "typed", my: number, o: { garbled?: boolean; trusted?: boolean }): Promise<void> {
    const text = raw.trim();
    const s0 = store.get();
    const lang = s0.lang;
    if (!text) {
      store.set({ status: "idle" });
      return;
    }
    store.set({ heard: text, status: "thinking" });
    store.log(`Heard: "${text}"`);
    this.retry = () => this.handleText(text, source, my, o);

    try {
      await this.prepare();
      // 1. "I heard ten. Is that right?" when the hearing is not trustworthy
      if (s0.pendingConfirm) {
        const c = matchCommand(text, lang);
        store.set({ pendingConfirm: null });
        if (c === "yes") return this.handleText(s0.pendingConfirm, source, my, { trusted: true });
        if (c === "no") {
          store.set({ status: "idle" });
          await this.speak([line("say_again", {}, outLangOf(s0))], { remember: false });
          return;
        }
      }
      if (!o.trusted && source === "voice" && (o.garbled || this.lowTrust(text))) {
        store.set({ pendingConfirm: text, status: "idle" });
        store.log(`Not sure about "${text}", asked to confirm`);
        await this.speak([line("heard_confirm", { text }, lang, { lang })], { remember: false });
        return;
      }

      // 2. answer to an offer ("Would you like me to speak slower...?")
      if (s0.pendingOffer) {
        const c = matchCommand(text, lang);
        if (c === "yes" || c === "no") return this.answerOffer(s0.pendingOffer, c === "yes");
        store.set({ pendingOffer: null });
      }

      // 3. checkout phrase: the one way to place an order by voice
      this.selfOrdering = true;
      let co: Outcome | null;
      try {
        co = await handleCheckoutUtterance(text, this.snap(text));
        if (co) await this.apply(co, my);
      } finally {
        this.selfOrdering = false;
      }
      if (co) return;

      // 4. "speak Hindi", "reply in Telugu"
      const lc = detectLanguageCommand(text);
      if (lc) return this.changeLanguage(lc);

      // 5. common one word commands, matched before translation.
      //    While a filter question is open, an answer is matched against that filter's own options first
      //    (no translation, no AI): "Samsung", "second", "under fifteen thousand", "skip", "yes".
      const cmd = matchCommand(text, lang, { hasOptions: s0.ctx.options.length > 0 || !!s0.ctx.asking });
      if (s0.ctx.asking && (cmd === null || cmd === "yes" || cmd === "no" || cmd === "first" || cmd === "second" || cmd === "third" || cmd === "skip")) {
        const ordinal = cmd === "first" ? 1 : cmd === "second" ? 2 : cmd === "third" ? 3 : undefined;
        const ans = await answerFacetText(text, ordinal, this.snap(text));
        if (ans) {
          store.log(`Understood your answer from the "${s0.ctx.asking}" filter's own options (no translation or AI needed)`);
          return this.apply(ans, my);
        }
      }
      if (cmd) {
        store.log(`Understood "${cmd}" from the word list (no translation or AI needed)`);
        return this.runCommand(cmd, my);
      }

      // 6. everything else: translate, let the LLM pick one action, run it
      await this.llmTurn(text, my);
    } catch (e) {
      if (this.stale(my)) return;
      await this.fail(e, "turn");
    }
  }

  private async llmTurn(text: string, my: number): Promise<void> {
    const s = store.get();
    let english = text;
    if (s.lang !== "en") {
      try {
        const r = await callApi<MtResponse>("/api/mt", { json: { from: s.lang, to: "en", text } }, s.faults);
        english = r.text;
        store.log(`Translated to English: "${english}"`);
        if (/\d/.test(normalizeDigits(text)) && !numbersPreserved(text, english)) {
          english = text;
          store.log("A number changed in translation, so the AI got your own words instead");
        }
      } catch (e) {
        if (e instanceof ClientApiError && e.code === "network") throw e;
        english = text;
        store.log(`Translation skipped (${e instanceof ClientApiError ? e.code : "error"}); the AI got your own words`);
      }
    }
    if (this.stale(my)) return;
    const st = store.get();
    const agent = await callApi<AgentResponse>(
      "/api/agent",
      { json: { text: english, state: { screen: st.ctx.screen, options: st.ctx.options, productId: st.ctx.productId, cartCount: cartLinesCount(st.cart), category: st.ctx.category, asking: st.ctx.asking } } },
      st.faults,
    );
    if (this.stale(my)) return;
    const via = agent.source === "groq" ? `the AI${agent.meta?.key ? `, key ${agent.meta.key} of ${agent.meta.keys}` : ""}` : agent.source === "mock" ? "the offline matcher (AI switched off)" : `the keyword matcher (AI ${agent.reason ?? "unavailable"})`;
    store.log(`Chose action "${agent.action.action}" using ${via}`);
    if (agent.meta?.rested?.length) store.log(`Key ${agent.meta.rested.join(", ")} was rate limited and rested; the next key took over`);
    await this.apply(await execute(agent.action, this.snap(english)), my);
  }

  private async runCommand(cmd: Cmd, my: number): Promise<void> {
    const s = store.get();
    const lang = outLangOf(s);
    const act = async (a: Action, text = "") => this.apply(await execute(a, this.snap(text)), my);
    switch (cmd) {
      case "repeat":
      case "what":
        this.signal({ type: "confused" });
        store.set({ status: "idle" });
        return this.repeat();
      case "slower":
      case "faster": {
        if (cmd === "slower") this.signal({ type: "confused" });
        const cur = s.prefs.speed;
        const next = Math.round(Math.max(0.6, Math.min(1.4, cmd === "slower" ? cur - 0.15 : cur + 0.15)) * 100) / 100;
        const atLimit = next === cur;
        store.set({ prefs: { ...s.prefs, speed: next } });
        store.set({ status: "idle" });
        await this.speak([line(atLimit ? (cmd === "slower" ? "speed_min" : "speed_max") : cmd === "slower" ? "speed_slower" : "speed_faster", {}, lang)], { remember: false });
        return;
      }
      case "stop":
      case "cancel":
        store.set({ status: "idle" });
        return;
      case "yes":
      case "no":
        store.set({ status: "idle" });
        await this.speak([line("not_understood", {}, lang)], { remember: false });
        return;
      case "back":
        return act(emptyAction("go_back"));
      case "first":
        return act({ ...emptyAction("open"), pick: 1 });
      case "second":
        return act({ ...emptyAction("open"), pick: 2 });
      case "third":
        return act({ ...emptyAction("open"), pick: 3 });
      case "help":
        return act(emptyAction("help"));
      case "whereami":
        return act(emptyAction("where_am_i"));
      case "startover":
        return this.apply(doStartOver(this.snap()), my);
      case "simpler":
        return act(emptyAction("explain_simpler"));
      case "skip":
        return act(emptyAction("skip_filter"));
      case "filters":
        return act(emptyAction("change_filters"));
    }
  }

  /* ------------------------------------------------------------------ *
   * Filters chosen by button or key, and changes announced by the page
   * ------------------------------------------------------------------ */

  /** A scan choice or a button picked one option of the filter being asked. */
  async answerOptionChoice(facet: string, option: string): Promise<void> {
    this.markUnlocked();
    this.stopScan();
    this.player.stop();
    const my = this.begin();
    store.set({ status: "thinking" });
    store.log(`Button or key: chose "${option}" for the "${facet}" filter`);
    try {
      await this.prepare();
      await this.apply(await flowAnswerOption(facet, option, this.snap("")), my);
    } catch (e) {
      if (!this.stale(my)) await this.fail(e, "turn");
    }
  }

  /** Tell the page which filters we set by voice, so its check boxes follow. */
  private pushFilters(): void {
    const c = store.get().ctx;
    if (!c.category) return;
    window.dispatchEvent(new CustomEvent<FiltersDetail>(UI_EVENT.setFilters, { detail: { category: c.category, filters: c.filters } }));
  }

  /** The page's language is ours too. */
  private pushLanguage(): void {
    window.dispatchEvent(new CustomEvent<LanguageDetail>(UI_EVENT.setLanguage, { detail: { lang: store.get().lang } }));
  }

  /** A shopper (or helper) ticked a filter on the page. Omnikart's next answer uses the same filters. */
  private onFiltersChanged = (e: Event): void => {
    const d = (e as CustomEvent<FiltersDetail>).detail;
    void (async () => {
      try {
        await this.prepare();
      } catch {
        return;
      }
      const s = store.get();
      const res = await this.adapter.search({ category: d.category, filters: d.filters });
      const step = s.ctx.step === "ask" || s.ctx.step === "filters" ? s.ctx.step : "matches";
      store.set({ ctx: { ...s.ctx, category: d.category, filters: d.filters, options: res.items.slice(0, 3).map((p) => p.id), screen: "results", productId: null, step } });
      store.log(`Page filters changed: ${res.items.length} products fit`);
      this.pushMarks();
      // if this was the question Omnikart was waiting on, it moves on
      const now = store.get().ctx;
      const asking = now.asking;
      if (asking && (asking === "budget" ? !!now.filters.price : (now.filters.sel[asking]?.length ?? 0) > 0)) {
        await this.apply(await continueFlow(this.snap("")), this.begin());
      }
    })();
  };

  /** Tag the products on offer on the page ("pick 1") so a sighted helper sees what Omnikart means. */
  private pushMarks(): void {
    void this.loadNames().then(() => {
      const s = store.get();
      const word = { en: "Omnikart's pick", hi: "ओम्नीकार्ट की पसंद", te: "ఓమ్నీకార్ట్ ఎంపిక" }[outLangOf(s)];
      const marks = s.ctx.options.flatMap((id, i) => (this.domIds[id] ? [{ id: this.domIds[id], label: `${word} ${i + 1}` }] : []));
      window.dispatchEvent(new CustomEvent<MarkDetail>(UI_EVENT.mark, { detail: { marks } }));
    });
  }

  /** Which page is showing, however the shopper got there: a link, the back button, or Omnikart's own move. */
  private onPage = (e: Event): void => {
    const d = (e as CustomEvent<PageDetail>).detail;
    const s = store.get();
    const ctx = { ...s.ctx };
    switch (d.kind) {
      case "product":
        ctx.screen = "product";
        ctx.productId = d.productId ?? null;
        if (ctx.step === "ask" || ctx.step === "filters" || ctx.step === "matches") ctx.step = "reviews";
        break;
      case "results": {
        ctx.screen = "results";
        ctx.productId = null;
        if (d.category && d.category !== ctx.category) {
          // arrived by link or the back button into a different category: its filters start fresh
          ctx.category = d.category;
          ctx.filters = d.filters ?? emptyFilters();
          ctx.queue = [];
          ctx.asking = null;
          ctx.options = (d.productIds ?? []).slice(0, 3);
          ctx.step = "matches";
        } else if (d.category && ctx.options.length === 0 && !ctx.asking) {
          ctx.options = (d.productIds ?? []).slice(0, 3);
        }
        ctx.checkout = null;
        break;
      }
      case "cart":
        ctx.screen = "cart";
        ctx.productId = null;
        break;
      case "checkout":
        ctx.screen = "checkout";
        ctx.productId = null;
        ctx.step = "order";
        break;
      case "orders":
        ctx.screen = s.ctx.screen === "ordered" && s.ctx.lastOrderId ? "ordered" : "home";
        ctx.productId = null;
        break;
      default:
        // the store's home page: a fresh start
        ctx.screen = "home";
        ctx.productId = null;
        ctx.category = null;
        ctx.filters = emptyFilters();
        ctx.queue = [];
        ctx.asking = null;
        ctx.options = [];
        ctx.step = "ask";
    }
    if (d.kind !== "checkout") {
      if (s.ctx.screen === "checkout") this.leftCheckoutAt = Date.now();
      ctx.checkout = null;
    }
    store.set({ ctx });
    if (d.kind === "results") this.pushMarks();
    // the shopper pressed "Proceed to buy" themselves: start the summary, as if they had asked for it
    if (d.kind === "checkout" && !s.ctx.checkout && !this.ordering) {
      void this.perform({ ...emptyAction("checkout"), payment: null });
    }
    // a product opened by a link: learn its category so "go back" returns to the right results
    if (d.kind === "product" && d.productId && !ctx.category) {
      void this.adapter.getProduct(d.productId).then((p) => p && store.set((st) => ({ ctx: { ...st.ctx, category: st.ctx.category ?? p.category } })));
    }
  };

  private onLanguageChanged = (e: Event): void => {
    const d = (e as CustomEvent<LanguageDetail>).detail;
    if (d.lang !== store.get().lang) store.set({ lang: d.lang, outLang: null });
  };

  private onPaymentChanged = (e: Event): void => {
    const d = (e as CustomEvent<PaymentDetail>).detail;
    const ck = store.get().ctx.checkout;
    if (ck && ck.payment !== d.payment) void this.perform({ ...emptyAction("checkout"), payment: d.payment });
  };

  private onCartChanged = (): void => {
    this.dirty = true;
    if (this.meta) void this.syncStore().catch(() => undefined);
  };

  /** Hold the page's Place order button until the summary has been heard to the end. */
  pushLock(message: string): void {
    const c = store.get().ctx;
    const locked = c.screen === "checkout" && !c.checkout?.readbackDone;
    window.dispatchEvent(new CustomEvent<CheckoutLockDetail>(UI_EVENT.checkoutLock, { detail: { locked, message: locked ? message : "" } }));
  }

  /** Outline what is being read aloud, or the choice one-key mode is on. */
  highlight(id: string | null, mode: "reading" | "scan", label?: string): void {
    window.dispatchEvent(new CustomEvent<HighlightDetail>(UI_EVENT.highlight, { detail: { id, mode, label } }));
  }

  /* ------------------------------------------------------------------ *
   * Applying an outcome
   * ------------------------------------------------------------------ */

  private async apply(out: Outcome, my: number): Promise<void> {
    if (this.stale(my)) return;
    out.log?.forEach((l) => store.log(l));
    const s = store.get();
    store.set({
      ...(out.cart ? { cart: out.cart } : {}),
      ...(out.orders ? { orders: out.orders } : {}),
      ...(out.ctx ? { ctx: { ...s.ctx, ...out.ctx } } : {}),
      status: out.lines.length || out.ask || out.repeat ? "thinking" : "idle",
    });
    if (out.ctx && (out.ctx.filters || out.ctx.category)) this.pushFilters();
    if (out.ctx?.options) this.pushMarks();
    if (out.nav) this.navigate(out.nav);
    if (out.repeat) return this.repeat();
    if (out.ask) return this.answerQuestion(out.ask.productId, out.ask.question, my);
    if (out.lines.length === 0) return;
    const lines = await this.phrase(out);
    if (this.stale(my)) return;
    await this.speak(lines, { remember: out.remember !== false });
    if (!this.stale(my)) await this.maybeOffer();
  }

  /**
   * LLM words, code numbers. Every sentence already has its real prices and dates in it, filled by code.
   * The AI may say the same thing more naturally; a rewrite is used only if every number, name and the
   * language are unchanged, and never at the checkout or for the order. Slow or failed: the original is spoken.
   */
  private async phrase(out: Outcome): Promise<Line[]> {
    const s = store.get();
    const screen = out.ctx?.screen ?? s.ctx.screen;
    if (screen === "checkout" || screen === "ordered" || out.lines.some((l) => l.readback)) return out.lines;
    const idx = out.lines.flatMap((l, i) => (canRewrite(l) ? [i] : [])).slice(0, 12);
    if (idx.length === 0) return out.lines;
    const lang = outLangOf(s);
    if (lang !== "en") return out.lines;
    try {
      const r = await Promise.race([
        callApi<{ lines: (string | null)[] }>("/api/compose", { json: { lang, lines: idx.map((i) => out.lines[i].caption) } }, s.faults),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), 2500)),
      ]);
      const rewrites: (string | null)[] = out.lines.map(() => null);
      idx.forEach((i, k) => (rewrites[i] = r.lines[k] ?? null));
      const m = mergeRewrites(out.lines, rewrites, lang);
      if (m.used || m.rejected) store.log(`Wording: the AI reworded ${m.used} sentence(s); ${m.rejected} kept as written because a number, name or the language changed`);
      return m.lines;
    } catch {
      return out.lines;
    }
  }

  private async answerQuestion(productId: string, question: string, my: number): Promise<void> {
    const s = store.get();
    const lang = outLangOf(s);
    let r: AskResponse;
    try {
      r = await callApi<AskResponse>("/api/ask", { json: { productId, question } }, s.faults);
    } catch (e) {
      if (this.stale(my)) return;
      return this.fail(e, "turn");
    }
    if (this.stale(my)) return;
    store.log(r.guarded ? "The AI's answer used a number that is not in the product data, so it was dropped" : r.found ? "Answer written from this product's own facts" : "The product facts do not say; told the shopper so");
    if (!r.found) return void (await this.speak([line("ask_unknown", {}, lang)]));
    if (lang === "en") return void (await this.speak([plain(r.answer)]));
    try {
      const t = await callApi<MtResponse>("/api/mt", { json: { from: "en", to: lang, text: r.answer } }, s.faults);
      if (!numbersPreserved(r.answer, t.text)) throw new ClientApiError("bad_response", 0, "numbers changed");
      await this.speak([plain(t.text)]);
    } catch (e) {
      if (e instanceof ClientApiError && e.code === "network") return this.fail(e, "turn");
      store.log("Translation of the answer was not safe (numbers or service), so it is spoken in English");
      await this.speak([plain(r.answer, { lang: "en" })]);
    }
  }

  /* ------------------------------------------------------------------ *
   * Language, offers, settings
   * ------------------------------------------------------------------ */

  private async changeLanguage(lc: LangCommand): Promise<void> {
    const s = store.get();
    if (lc.replyOnly) store.set({ outLang: lc.lang === s.lang ? null : lc.lang });
    else store.set({ lang: lc.lang, outLang: null });
    this.pushLanguage();
    store.set({ status: "idle" });
    store.log(lc.replyOnly ? `Reply language is now ${lc.lang}` : `Speaking and replying in ${lc.lang}`);
    await this.speak([plain(languageChangedText(lc.lang, lc.replyOnly), { lang: lc.lang })], { remember: false });
  }

  async setLanguage(lang: Lang): Promise<void> {
    store.set({ lang, outLang: null });
    this.pushLanguage();
    store.log(`Language set to ${lang}`);
  }

  private async answerOffer(offer: Offer, yes: boolean): Promise<void> {
    const s = store.get();
    const lang = outLangOf(s);
    store.set({ pendingOffer: null, status: "idle" });
    if (!yes) {
      store.set({ declined: [...new Set([...s.declined, offer])] });
      store.log(`Offer "${offer}" declined; it will not be made again`);
      await this.speak([line("offer_declined", {}, lang)], { remember: false });
      return;
    }
    const prefs = { ...s.prefs };
    if (offer === "motor") prefs.oneKey = true;
    if (offer === "calm") prefs.calm = true;
    if (offer === "contrast") {
      prefs.contrast = true;
      prefs.textScale = Math.max(prefs.textScale, 1.25);
    }
    store.set({ prefs });
    store.log(`Offer "${offer}" accepted`);
    await this.speak([line(offer === "motor" ? "accepted_motor" : offer === "calm" ? "accepted_calm" : "accepted_contrast", {}, lang)], { remember: false });
  }

  private async maybeOffer(): Promise<void> {
    const s = store.get();
    if (!this.unlocked || s.status !== "idle" || s.pendingOffer || s.offline) return;
    const offer = offerFor(s.signals, s.declined, { oneKey: s.prefs.oneKey, calm: s.prefs.calm, contrast: s.prefs.contrast });
    if (!offer) return;
    store.set({ pendingOffer: offer, signals: reduceSignal(s.signals, { type: "offered", offer }) });
    store.log(`Signals suggested one offer ("${offer}"). It is asked once and never labels you.`);
    await this.speak([line(offer === "motor" ? "offer_motor" : offer === "calm" ? "offer_calm" : "offer_contrast", {}, outLangOf(s))], { remember: false });
  }

  signal(e: SignalEvent): void {
    store.set((s) => ({ signals: reduceSignal(s.signals, e) }));
    void this.maybeOffer();
  }

  private updateEnv = (): void => {
    const zoom = window.visualViewport?.scale ?? 1;
    const contrastMore = typeof matchMedia === "function" && matchMedia("(prefers-contrast: more)").matches;
    store.set((s) => ({ signals: reduceSignal(s.signals, { type: "env", zoom, contrastMore }) }));
  };

  /* ------------------------------------------------------------------ *
   * Failure and the offline queue
   * ------------------------------------------------------------------ */

  private async fail(e: unknown, stage: "asr" | "turn"): Promise<void> {
    const lang = outLangOf(store.get());
    const code = e instanceof ClientApiError ? e.code : "unknown";
    store.log(`Problem in ${stage === "asr" ? "speech recognition" : "this step"}: ${code}`);
    playChime("problem");
    if (code === "network") return this.goOffline();
    store.set({ status: "idle" });
    if (code === "empty" && stage === "asr") {
      const failures = store.get().failures + 1;
      store.set({ failures, showPhrases: failures >= 2 || store.get().showPhrases });
      await this.speak([line("err_asr_empty", {}, lang)], { remember: false });
    } else if (code === "rate_limited") {
      await this.speak([line("err_busy", {}, lang)], { remember: false });
    } else if (code === "timeout" || (code === "bad_response" && stage === "asr")) {
      const failures = store.get().failures + 1;
      store.set({ failures, showPhrases: failures >= 2 || store.get().showPhrases });
      await this.speak([line("err_asr_slow", {}, lang)], { remember: false });
    } else {
      if (code === "not_configured") store.log("A service has no key or endpoint in the environment (see .env.example)");
      await this.speak([line("err_generic", {}, lang)], { remember: false });
    }
  }

  private async goOffline(): Promise<void> {
    store.set({ offline: true, status: "idle" });
    store.log("Connection lost. The request is queued and will be retried when you are back online.");
    await this.speak([line("err_offline", {}, outLangOf(store.get()))], { remember: false });
  }

  private onOnline = (): void => {
    if (store.get().offline && !store.get().faults.network) void this.resume();
  };

  private async resume(): Promise<void> {
    if (!store.get().offline) return;
    store.set({ offline: false });
    store.log("Back online. Trying the queued request again.");
    const job = this.retry;
    this.retry = null;
    await this.speak([line("back_online", {}, outLangOf(store.get()))], { remember: false });
    if (job) await job();
  }

  /* ------------------------------------------------------------------ *
   * One key mode
   * ------------------------------------------------------------------ */

  /** Called whenever where the shopper is changes. */
  refreshScan(): void {
    void this.loadNames().then(() => this.rebuildScan());
  }

  /** Names of the products on offer (and in the cart), for the spoken choices. */
  private async loadNames(): Promise<void> {
    const s = store.get();
    const ids = [...new Set([...s.ctx.options, ...(s.ctx.productId ? [s.ctx.productId] : []), ...s.cart.map((l) => l.id)])].filter((id) => !this.names[id]);
    if (ids.length === 0) return;
    try {
      for (const p of await this.adapter.getProducts(ids)) {
        this.names[p.id] = p.name;
        this.domIds[p.id] = p.domId;
      }
    } catch {
      /* offline: the choices that need names are left out until the store answers */
    }
  }

  private rebuildScan(): void {
    const s = store.get();
    if (!this.meta) return;
    this.scanChoices = buildScanChoices(s.ctx, s.cart, outLangOf(s), { meta: this.meta, names: this.names });
    this.stopScan();
    if (s.prefs.oneKey) this.startScan();
  }

  currentChoices(): ScanChoice[] {
    return this.scanChoices;
  }

  private startScan(): void {
    if (this.scanTimer) return;
    store.set({ scanIndex: -1 });
    this.scanTimer = setInterval(() => void this.scanTick(), this.effective().scanMs);
  }

  stopScan(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = null;
  }

  private async scanTick(): Promise<void> {
    const s = store.get();
    if (!s.prefs.oneKey || s.status !== "idle" || this.player.speaking || this.scanChoices.length === 0) return;
    const next = (s.scanIndex + 1) % this.scanChoices.length;
    store.set({ scanIndex: next });
    await this.speak([plain(this.scanChoices[next].label)], { remember: false });
  }

  /** Space in one key mode: choose what was just read. */
  private async selectScan(): Promise<void> {
    this.markUnlocked();
    const s = store.get();
    const choice = this.scanChoices[s.scanIndex];
    if (!choice) return;
    this.player.stop();
    store.set({ status: "idle" });
    store.log(`One key: chose "${choice.label}"`);
    if (choice.act.kind === "talk") return this.talk();
    if (choice.act.kind === "placeOrder") return this.placeOrderButton();
    if (choice.act.kind === "answer") {
      store.set({ scanIndex: -1 });
      return this.answerOptionChoice(choice.act.facet, choice.act.option);
    }
    store.set({ scanIndex: -1 });
    await this.perform(choice.act.action, { productId: choice.act.productId });
  }

  /* ------------------------------------------------------------------ *
   * Keyboard and pointer
   * ------------------------------------------------------------------ */

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
    if (e.key === "Escape") {
      this.cancelAll();
      return;
    }
    if (e.code !== "Space" && e.key !== " ") return;
    if (typing) return;
    const onTalk = target?.id === "talk-button";
    const onControl = !!target && target !== document.body && !onTalk && !!target.closest("a,button,select,summary,[role=button],[role=menuitem]");
    const oneKey = store.get().prefs.oneKey;
    if (onControl && !oneKey) return;
    e.preventDefault();
    this.spaceHandled = true;
    if (e.repeat) return;
    if (oneKey) void this.selectScan();
    else void this.talk();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.spaceHandled && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      this.spaceHandled = false;
    }
  };

  private onClick = (e: MouseEvent): void => {
    const el = e.target as Element | null;
    if (!el?.closest) return;
    if (el.closest("[data-talk]")) return;
    const hit = el.closest("a,button,input,select,textarea,summary,[role=button],[data-interactive]");
    const now = performance.now();
    if (!hit) {
      this.signal({ type: "miss", t: Date.now() });
      return;
    }
    if (this.lastClick.el === hit && now - this.lastClick.t < THRESHOLDS.doubleHitMs) this.signal({ type: "doublehit" });
    this.lastClick = { t: now, el: hit };
  };

  private onPointerDown = (e: PointerEvent): void => {
    const el = e.target as Element | null;
    if (!el?.closest || el.closest("[data-talk]")) {
      this.pressStart = 0;
      return;
    }
    this.pressStart = el.closest("a,button,input,select,textarea,summary,[role=button]") ? performance.now() : 0;
  };

  private onPointerUp = (): void => {
    if (!this.pressStart) return;
    const d = performance.now() - this.pressStart;
    this.pressStart = 0;
    if (d > THRESHOLDS.longPressMs && d < 5000) this.signal({ type: "longpress" });
  };
}
