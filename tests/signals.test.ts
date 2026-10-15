import { describe, expect, it } from "vitest";
import { effectiveModes, initialSignals, offerFor, reduceSignal, type SignalEvent } from "@/assistant/signals";

const OFF = { oneKey: false, calm: false, contrast: false };
const feed = (events: SignalEvent[]) => events.reduce(reduceSignal, initialSignals());

describe("hand-motor signals", () => {
  it("three mis-taps within ten seconds offer one key mode", () => {
    const s = feed([{ type: "miss", t: 1000 }, { type: "miss", t: 3000 }, { type: "miss", t: 6000 }]);
    expect(offerFor(s, [], OFF, 6000)).toBe("motor");
  });
  it("mis-taps spread over a minute do not", () => {
    const s = feed([{ type: "miss", t: 0 }, { type: "miss", t: 30_000 }, { type: "miss", t: 60_000 }]);
    expect(offerFor(s, [], OFF, 60_000)).toBeNull();
  });
  it("two long presses or two double hits offer it", () => {
    expect(offerFor(feed([{ type: "longpress" }, { type: "longpress" }]), [], OFF)).toBe("motor");
    expect(offerFor(feed([{ type: "doublehit" }, { type: "doublehit" }]), [], OFF)).toBe("motor");
  });
  it("one slip is not enough", () => {
    expect(offerFor(feed([{ type: "miss", t: 1 }, { type: "longpress" }, { type: "doublehit" }]), [], OFF, 2)).toBeNull();
  });
});

describe("ageing signals", () => {
  it("saying 'what' twice offers calm mode", () => {
    expect(offerFor(feed([{ type: "confused" }, { type: "confused" }]), [], OFF)).toBe("calm");
  });
  it("two long silences offer it", () => {
    expect(offerFor(feed([{ type: "pause" }, { type: "pause" }]), [], OFF)).toBe("calm");
  });
  it("once is not enough", () => {
    expect(offerFor(feed([{ type: "confused" }, { type: "pause" }]), [], OFF)).toBeNull();
  });
});

describe("low vision signals", () => {
  it("zoom of 150 percent or a contrast preference offers larger text", () => {
    expect(offerFor(feed([{ type: "env", zoom: 1.5, contrastMore: false }]), [], OFF)).toBe("contrast");
    expect(offerFor(feed([{ type: "env", zoom: 1, contrastMore: true }]), [], OFF)).toBe("contrast");
    expect(offerFor(feed([{ type: "env", zoom: 1.2, contrastMore: false }]), [], OFF)).toBeNull();
  });
});

describe("offers are polite", () => {
  const motor = feed([{ type: "longpress" }, { type: "longpress" }]);
  it("never offers what is already on", () => {
    expect(offerFor(motor, [], { ...OFF, oneKey: true })).toBeNull();
  });
  it("never offers what was declined, even in a later session", () => {
    expect(offerFor(motor, ["motor"], OFF)).toBeNull();
  });
  it("offers each thing once per session", () => {
    const after = reduceSignal(motor, { type: "offered", offer: "motor" });
    expect(offerFor(after, [], OFF)).toBeNull();
    expect(reduceSignal(after, { type: "offered", offer: "motor" }).offered).toEqual(["motor"]);
  });
  it("makes one offer at a time, motor first", () => {
    const s = feed([{ type: "longpress" }, { type: "longpress" }, { type: "confused" }, { type: "confused" }]);
    expect(offerFor(s, [], OFF)).toBe("motor");
    const next = reduceSignal(s, { type: "offered", offer: "motor" });
    expect(offerFor(next, [], OFF)).toBe("calm");
  });
});

describe("stricter setting wins when conditions combine", () => {
  const base = { speed: 1, textScale: 1, calm: false, contrast: false, oneKey: false };
  it("defaults", () => {
    expect(effectiveModes(base)).toMatchObject({ speed: 1, textScale: 1, silenceMs: 2000, maxWords: 25, scanMs: 1500 });
  });
  it("calm mode: slowest voice, largest text, longest wait, shortest sentences", () => {
    expect(effectiveModes({ ...base, calm: true })).toMatchObject({ speed: 0.8, textScale: 1.5, silenceMs: 3500, maxWords: 15, scanMs: 3000 });
  });
  it("the shopper's own slower speed is never made faster", () => {
    expect(effectiveModes({ ...base, calm: true, speed: 0.6 }).speed).toBe(0.6);
  });
  it("a larger text size set by the shopper is kept", () => {
    expect(effectiveModes({ ...base, calm: true, textScale: 2 }).textScale).toBe(2);
    expect(effectiveModes({ ...base, contrast: true }).textScale).toBe(1.25);
  });
});
