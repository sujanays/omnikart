import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeWav } from "@/assistant/client/recorder";
import { wavInfo } from "@/assistant/anuvaad";
import { voiceKey } from "@/assistant/voicekey";
import { Player } from "@/assistant/client/player";
import { splitForSpeech } from "@/assistant/speakable";
import { buildScanChoices } from "@/assistant/client/scan";
import { initialCtx } from "@/assistant/agent/state";
import { PRODUCTS } from "@/store/catalogue";
import { META } from "./helpers";
import { plain, type Line } from "@/assistant/agent/templates";

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16 bit WAV that the server accepts", () => {
    const samples = new Float32Array(16000).map((_, i) => Math.sin(i / 10) * 0.5);
    const buf = encodeWav(samples, 16000);
    const info = wavInfo(buf)!;
    expect(info.sampleRate).toBe(16000);
    expect(info.seconds).toBeCloseTo(1, 3);
    expect(buf.byteLength).toBe(44 + 16000 * 2);
  });
  it("clips instead of wrapping around", () => {
    const buf = encodeWav(new Float32Array([2, -2, 0.5]), 16000);
    const v = new DataView(buf);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
    expect(v.getInt16(48, true)).toBeGreaterThan(16000);
  });
});

describe("voiceKey", () => {
  it("is stable and depends on language and text", () => {
    expect(voiceKey("en", "hello")).toBe(voiceKey("en", "hello"));
    expect(voiceKey("en", "hello")).not.toBe(voiceKey("hi", "hello"));
    expect(voiceKey("en", "hello")).not.toBe(voiceKey("en", "hello!"));
    expect(voiceKey("te", "హలో")).toMatch(/^te-[0-9a-f]{8}-[0-9a-f]+$/);
  });
});

/* ---- Player with a fake audio element ---- */

class FakeAudio {
  static played: string[] = [];
  static hold = false;
  src = "";
  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  private listeners: Record<string, (() => void)[]> = {};
  addEventListener(e: string, fn: () => void) {
    (this.listeners[e] ??= []).push(fn);
  }
  removeEventListener(e: string, fn: () => void) {
    this.listeners[e] = (this.listeners[e] ?? []).filter((f) => f !== fn);
  }
  pause() {}
  play() {
    FakeAudio.played.push(this.src);
    if (!FakeAudio.hold) setTimeout(() => (this.listeners.ended ?? []).forEach((f) => f()), 10);
    return Promise.resolve();
  }
}

const L = (s: string): Line => plain(s);
const base = { lang: "en" as const, speed: 1, maxWords: 25, voice: true };

describe("Player", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudio.played = [];
    FakeAudio.hold = false;
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays saved audio from the voice pack without calling text to speech", async () => {
    const tts = vi.fn(async () => "https://live/x.wav");
    const p = new Player(tts);
    const chunk = splitForSpeech("Hello there.", "en")[0];
    p.setManifest({ [voiceKey("en", chunk)]: "/audio/en/a.wav" });
    const done = p.speak([L("Hello there.")], base);
    await vi.advanceTimersByTimeAsync(50);
    expect(await done).toEqual({ completed: true });
    expect(FakeAudio.played).toEqual(["/audio/en/a.wav"]);
    expect(tts).not.toHaveBeenCalled();
  });

  it("calls live text to speech for unknown lines, and keeps the result for a repeat", async () => {
    const tts = vi.fn(async () => "https://live/x.wav");
    const p = new Player(tts);
    for (let i = 0; i < 2; i++) {
      const done = p.speak([L("A brand new sentence.")], base);
      await vi.advanceTimersByTimeAsync(50);
      await done;
    }
    expect(tts).toHaveBeenCalledTimes(1);
    expect(FakeAudio.played).toEqual(["https://live/x.wav", "https://live/x.wav"]);
  });

  it("reports each line start in order", async () => {
    const p = new Player(async () => "https://live/x.wav");
    const started: string[] = [];
    const done = p.speak([L("One."), L("Two."), L("Three.")], { ...base, onLineStart: (l) => started.push(l.caption) });
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(started).toEqual(["One.", "Two.", "Three."]);
  });

  it("an interrupted read-back is NOT completed", async () => {
    FakeAudio.hold = true;
    const p = new Player(async () => "https://live/x.wav");
    const done = p.speak([L("First."), L("Second.")], base);
    await vi.advanceTimersByTimeAsync(20);
    p.stop();
    expect(await done).toEqual({ completed: false });
    expect(p.speaking).toBe(false);
  });

  it("a newer speak call stops the older one", async () => {
    FakeAudio.hold = true;
    const p = new Player(async () => "https://live/x.wav");
    const first = p.speak([L("Old line.")], base);
    await vi.advanceTimersByTimeAsync(20);
    FakeAudio.hold = false;
    const second = p.speak([L("New line.")], base);
    await vi.advanceTimersByTimeAsync(100);
    expect(await first).toEqual({ completed: false });
    expect(await second).toEqual({ completed: true });
  });

  it("with no text to speech and no browser voice, captions stay and the player waits long enough to read them", async () => {
    const p = new Player(async () => {
      throw new Error("not_configured");
    });
    const notes: string[] = [];
    let finished = false;
    const done = p.speak([L("Please read this caption.")], { ...base, onNote: (m) => notes.push(m) }).then((r) => {
      finished = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await done).toEqual({ completed: true });
    expect(notes.length).toBe(1);
    expect(notes[0]).toMatch(/captions only/);
  });

  it("an unconfigured service is not retried for every chunk", async () => {
    const tts = vi.fn(async () => {
      throw new Error("not_configured");
    });
    const p = new Player(tts);
    const a = p.speak([L("First line.")], base);
    await vi.advanceTimersByTimeAsync(3000);
    await a;
    const b = p.speak([L("Second line.")], base);
    await vi.advanceTimersByTimeAsync(3000);
    await b;
    expect(tts).toHaveBeenCalledTimes(1);
  });

  it("voice off: shows each line for a while and still reports completion", async () => {
    const p = new Player(async () => "x");
    const started: string[] = [];
    const done = p.speak([L("Line one."), L("Line two.")], { ...base, voice: false, onLineStart: (l) => started.push(l.caption) });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await done).toEqual({ completed: true });
    expect(started).toEqual(["Line one.", "Line two."]);
    expect(FakeAudio.played).toEqual([]);
  });

  it("splits a long line into chunks of 25 words or fewer", async () => {
    const tts = vi.fn(async (_l: string, text: string) => `https://live/${text.split(" ").length}.wav`);
    const p = new Player(tts);
    const long = Array.from({ length: 60 }, () => "word").join(" ") + ".";
    const done = p.speak([L(long)], base);
    await vi.advanceTimersByTimeAsync(500);
    await done;
    expect(tts.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const c of tts.mock.calls) expect((c[1] as string).split(" ").length).toBeLessThanOrEqual(25);
  });
});

const NAMES = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.name]));
const VIEW = { meta: META, names: NAMES };

describe("one key mode choices", () => {
  const COOKER = "cooker-hawkins-classic-3";
  it("on the home page: the five categories first, then talk and help", () => {
    const c = buildScanChoices(initialCtx(), [], "en", VIEW);
    expect(c.slice(0, 5).map((x) => x.id)).toEqual(["cat-phones", "cat-jeans", "cat-cookers", "cat-earbuds", "cat-shoes"]);
    expect(c.map((x) => x.id).slice(-2)).toEqual(["talk", "help"]);
  });
  it("choosing a category starts the guided journey", () => {
    const c = buildScanChoices(initialCtx(), [], "en", VIEW).find((x) => x.id === "cat-jeans")!;
    expect(c.act).toMatchObject({ kind: "action", action: { action: "search", category: "jeans" } });
  });
  it("while a filter is asked: its options, then skip and 'show matches now', then talk and help", () => {
    const ctx = { ...initialCtx(), screen: "results" as const, category: "phones" as const, asking: "brand", step: "filters" as const };
    const c = buildScanChoices(ctx, [], "en", VIEW);
    expect(c.map((x) => x.id)).toEqual(["opt-redmi", "opt-samsung", "opt-realme", "opt-iqoo", "skip", "matches", "talk", "help"]);
    expect(c[1].act).toEqual({ kind: "answer", facet: "brand", option: "samsung" });
  });
  it("a yes or no filter offers one Yes", () => {
    const ctx = { ...initialCtx(), screen: "results" as const, category: "phones" as const, asking: "battery", step: "filters" as const };
    expect(buildScanChoices(ctx, [], "en", VIEW)[0]).toMatchObject({ id: "yes", label: "Yes", act: { kind: "answer", facet: "battery" } });
  });
  it("once the matches are read: the options, change filters, talk, help", () => {
    const ctx = { ...initialCtx(), screen: "results" as const, category: "cookers" as const, step: "matches" as const, options: [COOKER, "cooker-prestige-deluxe-5"] };
    const c = buildScanChoices(ctx, [], "en", VIEW);
    expect(c.slice(0, 2).map((x) => x.id)).toEqual([`open-${COOKER}`, "open-cooker-prestige-deluxe-5"]);
    expect(c[0].domId).toBe(`product-${COOKER}`);
    expect(c.map((x) => x.id)).toContain("filters");
    expect(c.map((x) => x.id).slice(-2)).toEqual(["talk", "help"]);
  });
  it("on a product: reviews, delivery and add to cart are offered, in the shopper's language", () => {
    const c = buildScanChoices({ ...initialCtx(), screen: "product", productId: COOKER }, [], "hi", VIEW);
    expect(c.slice(0, 3).map((x) => x.id)).toEqual(["reviews", "delivery", "add"]);
    expect(c[0].label).toBe("रिव्यू सुनें");
    expect(c[2].label).toBe("कार्ट में डालें");
  });
  it("the Place order choice appears only after the read-back has been heard", () => {
    const at = (done: boolean) =>
      buildScanChoices({ ...initialCtx(), screen: "checkout", checkout: { payment: "cod", readbackDone: done } }, [{ id: COOKER, qty: 1 }], "en", VIEW).map((x) => x.id);
    expect(at(false)).not.toContain("place");
    expect(at(true)).toContain("place");
  });
  it("every choice's label is spoken in the chosen language: no Latin letters in Hindi or Telugu choices except none", () => {
    for (const lang of ["hi", "te"] as const) {
      const ctx = { ...initialCtx(), screen: "results" as const, category: "shoes" as const, asking: "type", step: "filters" as const };
      for (const c of buildScanChoices(ctx, [], lang, VIEW)) expect(c.label, `${lang} ${c.id}`).not.toMatch(/[A-Za-z]/);
    }
  });
  it("every choice does no more than a voice command could", () => {
    for (const screen of ["home", "results", "product", "cart", "checkout", "ordered"] as const) {
      for (const asking of [null, "budget"]) {
        const ctx = { ...initialCtx(), screen, category: "phones" as const, asking, productId: COOKER, options: [COOKER], checkout: { payment: "cod" as const, readbackDone: true } };
        for (const c of buildScanChoices(ctx, [{ id: COOKER, qty: 1 }], "en", VIEW)) {
          if (c.act.kind === "action") expect(["place_order", "confirm_order"]).not.toContain(c.act.action.action);
        }
      }
    }
  });
});
