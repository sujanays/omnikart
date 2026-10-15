import { describe, expect, it } from "vitest";
import { LANGS } from "@/contract/lang";
import {
  LANGUAGE_WORD,
  PAYMENT_NAME,
  REASON,
  T,
  formatDate,
  joinList,
  languageChangedText,
  line,
  render,
  slotsOf,
  type TemplateId,
} from "@/assistant/agent/templates";
import { META } from "./helpers";
import { splitForSpeech, wordCount } from "@/assistant/speakable";

const ids = Object.keys(T) as TemplateId[];

describe("templates", () => {
  it("every template has text in all three languages", () => {
    for (const id of ids) for (const l of LANGS) expect(T[id][l].trim().length, `${id}.${l}`).toBeGreaterThan(0);
  });

  it("every language uses exactly the same slots", () => {
    for (const id of ids) {
      const en = slotsOf(T[id].en);
      expect(slotsOf(T[id].hi), `${id} hi`).toEqual(en);
      expect(slotsOf(T[id].te), `${id} te`).toEqual(en);
    }
  });

  it("Hindi and Telugu text has no stray English words outside slots", () => {
    for (const id of ids) {
      for (const l of ["hi", "te"] as const) {
        const withoutSlots = T[id][l].replace(/\{[a-zA-Z0-9_]+\}/g, "");
        expect(withoutSlots, `${id}.${l}`).not.toMatch(/[A-Za-z]{2,}/);
      }
    }
  });

  it("Hindi first person uses feminine forms (the voice is female)", () => {
    for (const id of ids) expect(T[id].hi, id).not.toMatch(/सकता हूँ|रहा हूँ|ूँगा|पाया।/);
  });

  it("slot names are plain words", () => {
    for (const id of ids) for (const l of LANGS) for (const s of slotsOf(T[id][l])) expect(s).toMatch(/^[a-z][a-zA-Z0-9]*$/);
  });

  it("every spoken template fits the speech splitter: no chunk over 25 words in any language", () => {
    for (const id of ids) {
      for (const l of LANGS) {
        const text = T[id][l].replace(/\{[a-zA-Z0-9_]+\}/g, "word");
        for (const c of splitForSpeech(text, l)) expect(wordCount(c), `${id}.${l}`).toBeLessThanOrEqual(25);
      }
    }
  });
});

describe("render", () => {
  it("money reads as ₹1,299 on screen and as digits plus rupees for speech", () => {
    const cap = render("Total {total}.", { total: { money: 1299 } }, "en", "caption");
    const sp = render("Total {total}.", { total: { money: 1299 } }, "en", "speech");
    expect(cap).toBe("Total ₹1,299.");
    expect(sp).toBe("Total 1299 rupees.");
  });
  it("Indian grouping on screen", () => {
    expect(render("{p}", { p: { money: 125000 } }, "en", "caption")).toBe("₹1,25,000");
  });
  it("digits slot is spelled out for speech and kept for the eyes", () => {
    expect(render("{d}", { d: { digits: "407" } }, "en", "caption")).toBe("407");
    expect(render("{d}", { d: { digits: "407" } }, "en", "speech")).toBe("four zero seven");
  });
  it("a missing slot is an error, not a silent hole", () => {
    expect(() => render("Hello {name}", {}, "en", "caption")).toThrow(/Missing slot/);
  });
});

describe("line", () => {
  it("builds caption and speech from a template id", () => {
    const l = line("cart_total", { total: { money: 1199 } }, "en");
    expect(l.caption).toBe("Total ₹1,199.");
    expect(l.speech).toBe("Total 1199 rupees.");
  });
  it("Hindi speech uses the Hindi rupee word", () => {
    expect(line("cart_total", { total: { money: 1199 } }, "hi").speech).toContain("रुपये");
  });
});

describe("helpers", () => {
  it("joinList", () => {
    expect(joinList(["a"], "en")).toBe("a");
    expect(joinList(["a", "b", "c"], "en")).toBe("a, b and c");
    expect(joinList(["a", "b"], "hi")).toBe("a और b");
  });
  it("reasons, payments, address and language words exist in all languages", () => {
    for (const l of LANGS) {
      for (const r of Object.values(REASON)) expect(r[l]).toBeTruthy();
      for (const r of Object.values(PAYMENT_NAME)) expect(r[l]).toBeTruthy();
      expect(META.address.full[l]).toBeTruthy();
      expect(META.address.short[l]).toBeTruthy();
      expect(LANGUAGE_WORD[l]).toBeTruthy();
      for (const to of LANGS) {
        expect(languageChangedText(to, true)).toBeTruthy();
        expect(languageChangedText(to, false)).toBeTruthy();
      }
    }
  });
  it("formatDate gives a weekday and a month in each language", () => {
    const d = new Date(2026, 9, 14);
    for (const l of LANGS) expect(formatDate(d, l).length).toBeGreaterThan(5);
    expect(formatDate(d, "en")).toMatch(/Wednesday/);
  });
});
