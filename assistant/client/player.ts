import { LANG_TAG, type Lang } from "@/contract/lang";
import { splitForSpeech, wordCount } from "@/assistant/speakable";
import { voiceKey } from "@/assistant/voicekey";
import type { Line } from "@/assistant/agent/templates";

/**
 * Plays what Omnikart says, one short chunk at a time.
 *
 * Where each chunk's audio comes from, best first:
 *   1. the voice pack (saved audio made ahead of time, plays at once, works with a weak network)
 *   2. a live text to speech call (kept in memory so a repeat is instant)
 *   3. the browser's own voice
 *   4. nothing: the caption stays on screen and we wait long enough to read it
 *
 * stop() silences everything at once. A newer speak() call also stops the older one.
 */

export interface SpeakOptions {
  lang: Lang;
  speed: number;
  maxWords: number;
  /** false: captions only (screen reader mode) */
  voice: boolean;
  onLineStart?: (line: Line, index: number) => void;
  onNote?: (message: string) => void;
}

export interface SpeakResult {
  /** true only if every chunk played to the end without being stopped */
  completed: boolean;
}

type Source = { kind: "url"; url: string } | { kind: "browser" } | { kind: "none" };

interface Item {
  line: number;
  lang: Lang;
  text: string;
}

export type TtsFetcher = (lang: Lang, text: string) => Promise<string>;

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export class Player {
  private gen = 0;
  private el: HTMLAudioElement | null = null;
  private manifest: Record<string, string> = {};
  private blobs = new Map<string, string>();
  private live = new Map<string, string>();
  private abortWait: (() => void) | null = null;
  private busy = false;
  /** live text to speech is unavailable until this time (it has no endpoint, or the key is bad) */
  private ttsDownUntil = 0;

  constructor(private fetchTts: TtsFetcher) {}

  get speaking(): boolean {
    return this.busy;
  }

  setManifest(m: Record<string, string>): void {
    this.manifest = m;
  }

  /** Call inside a tap or key press so browsers allow audio later. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = "auto";
    }
    if (!this.el.src || this.el.src === SILENT_WAV) {
      this.el.src = SILENT_WAV;
      void this.el.play().catch(() => undefined);
    }
  }

  stop(): void {
    this.gen++;
    this.busy = false;
    this.abortWait?.();
    this.abortWait = null;
    try {
      this.el?.pause();
    } catch {
      /* nothing playing */
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  /** Fetch saved audio for these texts now, so they still play when the connection drops. */
  async warm(lang: Lang, texts: string[]): Promise<void> {
    for (const text of texts) {
      for (const chunk of splitForSpeech(text, lang)) {
        const key = voiceKey(lang, chunk);
        const path = this.manifest[key];
        if (!path || this.blobs.has(key)) continue;
        try {
          const res = await fetch(path);
          if (res.ok) this.blobs.set(key, URL.createObjectURL(await res.blob()));
        } catch {
          /* offline already; skip */
        }
      }
    }
  }

  async speak(lines: Line[], o: SpeakOptions): Promise<SpeakResult> {
    this.stop();
    const my = this.gen;
    this.busy = true;
    const items: Item[] = [];
    lines.forEach((line, li) => {
      const lang = line.lang ?? o.lang;
      const chunks = splitForSpeech(line.speech, lang, o.maxWords);
      if (chunks.length === 0) items.push({ line: li, lang, text: "" });
      for (const text of chunks) items.push({ line: li, lang, text });
    });

    const alive = () => this.gen === my;
    let noted = false;
    const note = (m: string) => {
      if (!noted) {
        noted = true;
        o.onNote?.(m);
      }
    };

    if (!o.voice) {
      // Captions only: show each line for long enough to be read by a screen reader.
      for (let li = 0; li < lines.length; li++) {
        if (!alive()) return { completed: false };
        o.onLineStart?.(lines[li], li);
        await this.sleep(Math.max(900, wordCount(lines[li].speech) * 330), my);
      }
      const done = alive();
      if (done) this.busy = false;
      return { completed: done };
    }

    const sources: Promise<Source>[] = [];
    const ensure = (i: number) => {
      if (i < items.length) sources[i] ??= this.resolve(items[i], my, note);
    };

    let lastLine = -1;
    for (let i = 0; i < items.length; i++) {
      if (!alive()) return { completed: false };
      ensure(i);
      ensure(i + 1);
      ensure(i + 2);
      const src = await sources[i];
      if (!alive()) return { completed: false };
      if (items[i].line !== lastLine) {
        lastLine = items[i].line;
        o.onLineStart?.(lines[lastLine], lastLine);
      }
      if (!items[i].text) continue;
      await this.play(src, items[i], o, my, note);
    }
    const done = alive();
    if (done) this.busy = false;
    return { completed: done };
  }

  private async resolve(item: Item, my: number, note: (m: string) => void): Promise<Source> {
    if (!item.text) return { kind: "none" };
    const key = voiceKey(item.lang, item.text);
    const blob = this.blobs.get(key);
    if (blob) return { kind: "url", url: blob };
    const packed = this.manifest[key];
    if (packed) return { kind: "url", url: packed };
    const cached = this.live.get(key);
    if (cached) return { kind: "url", url: cached };
    if (Date.now() < this.ttsDownUntil) return typeof speechSynthesis !== "undefined" ? { kind: "browser" } : { kind: "none" };
    try {
      const url = await this.fetchTts(item.lang, item.text);
      if (this.gen === my) this.live.set(key, url);
      return { kind: "url", url };
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      if (code === "not_configured" || code === "auth") this.ttsDownUntil = Date.now() + 10 * 60_000;
      if (typeof speechSynthesis !== "undefined") {
        note(`Text to speech failed (${code}), used the browser voice`);
        return { kind: "browser" };
      }
      note(`Text to speech failed (${code}), captions only`);
      return { kind: "none" };
    }
  }

  private async play(src: Source, item: Item, o: SpeakOptions, my: number, note: (m: string) => void): Promise<void> {
    if (src.kind === "url") {
      const ok = await this.playUrl(src.url, o.speed, my);
      if (ok || this.gen !== my) return;
      note("Audio could not play, used the browser voice");
      if (typeof speechSynthesis !== "undefined") {
        await this.playBrowser(item, o.speed, my);
        return;
      }
    } else if (src.kind === "browser") {
      await this.playBrowser(item, o.speed, my);
      return;
    }
    await this.sleep(Math.max(700, wordCount(item.text) * 330), my);
  }

  /** Resolves true if the audio played to its end. */
  private playUrl(url: string, speed: number, my: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.el) this.el = new Audio();
      const el = this.el;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(stall);
        el.removeEventListener("ended", onEnd);
        el.removeEventListener("error", onErr);
        el.removeEventListener("playing", onPlaying);
        this.abortWait = null;
        resolve(ok);
      };
      const onEnd = () => finish(true);
      const onErr = () => finish(false);
      const onPlaying = () => clearTimeout(stall);
      const stall = setTimeout(() => finish(false), 9000);
      this.abortWait = () => finish(false);
      el.addEventListener("ended", onEnd);
      el.addEventListener("error", onErr);
      el.addEventListener("playing", onPlaying);
      el.src = url;
      el.defaultPlaybackRate = speed;
      el.playbackRate = speed;
      if (this.gen !== my) return finish(false);
      el.play().catch(() => finish(false));
    });
  }

  private playBrowser(item: Item, speed: number, my: number): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined" || this.gen !== my) return resolve();
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = LANG_TAG[item.lang];
      u.rate = speed;
      const prefix = LANG_TAG[item.lang].slice(0, 2).toLowerCase();
      const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(prefix));
      if (v) u.voice = v;
      // Some devices have no voice for Hindi or Telugu and never fire "end". Do not wait forever.
      const watchdog = setTimeout(() => done(), Math.max(3000, (wordCount(item.text) * 650) / Math.max(0.5, speed)) + 2000);
      const done = () => {
        clearTimeout(watchdog);
        this.abortWait = null;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      this.abortWait = done;
      speechSynthesis.speak(u);
    });
  }

  private sleep(ms: number, my: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.abortWait = null;
        resolve();
      }, ms);
      this.abortWait = () => {
        clearTimeout(t);
        resolve();
      };
      if (this.gen !== my) {
        clearTimeout(t);
        resolve();
      }
    });
  }
}
