import { describe, expect, it } from "vitest";
import { canRewrite, mergeRewrites, rewriteIsSafe } from "@/assistant/agent/compose";

const SENT = "Number 1: Samsung Galaxy M35 5G, ₹14,999. It is the cheapest of these.";

describe("LLM words, code numbers: a rewrite is used only if it is safe", () => {
  it("accepts the same facts said differently", () => {
    expect(rewriteIsSafe(SENT, "Here is my first pick, the Samsung Galaxy M35 5G at ₹14,999. It is the cheapest of the lot.", "en")).toBe(true);
  });
  it("rejects a changed price or an added number", () => {
    expect(rewriteIsSafe(SENT, "My first pick, the Samsung Galaxy M35 5G at ₹13,999, the cheapest.", "en")).toBe(false);
    expect(rewriteIsSafe(SENT, "My first pick, the Samsung Galaxy M35 5G at ₹14,999, with 2 years warranty.", "en")).toBe(false);
    // leaving a number out is harmless; the voice just does not say it
    expect(rewriteIsSafe(SENT, "My first pick is the Samsung Galaxy M35 5G, and it is the cheapest.", "en")).toBe(true);
  });
  it("rejects a lost brand or model name", () => {
    expect(rewriteIsSafe(SENT, "Number 1 is a phone from Samsung at ₹14,999 5G. The cheapest one.", "en")).toBe(false);
  });
  it("is the same number in another format? 14999 and 14,999 are the same; 149 99 is not", () => {
    expect(rewriteIsSafe("Total ₹14,999 today.", "Your total is 14999 rupees today friend.", "en")).toBe(true);
    expect(rewriteIsSafe("Total ₹14,999 today.", "Your total is 149 99 rupees today friend.", "en")).toBe(false);
  });
  it("keeps Hindi in Hindi and Telugu in Telugu", () => {
    expect(rewriteIsSafe("यह फ़ोन ₹14,999 का है और सबसे सस्ता है।", "This phone costs ₹14,999 and is cheapest.", "hi")).toBe(false);
    expect(rewriteIsSafe("यह फ़ोन ₹14,999 का है और सबसे सस्ता है।", "यह फ़ोन सिर्फ़ ₹14,999 का है, और सबसे सस्ता भी।", "hi")).toBe(true);
    expect(rewriteIsSafe("ఈ ఫోన్ ₹14,999 మాత్రమే, చాలా చవక.", "This phone is cheap at ₹14,999 only now.", "te")).toBe(false);
  });
  it("rejects instructions, markup, empty text, and rambling", () => {
    expect(rewriteIsSafe(SENT, "", "en")).toBe(false);
    expect(rewriteIsSafe(SENT, "<b>Number 1: Samsung Galaxy M35 5G, ₹14,999.</b> The cheapest.", "en")).toBe(false);
    expect(rewriteIsSafe(SENT, SENT + " " + "Buy it now because it is a really wonderful choice for everybody ".repeat(4), "en")).toBe(false);
  });
  it("never rewrites the read-back, cards, lists or very short lines", () => {
    expect(canRewrite({ caption: SENT, readback: true })).toBe(false);
    expect(canRewrite({ caption: SENT, card: {} })).toBe(false);
    expect(canRewrite({ caption: "Battery: 6000 mAh\nStorage: 128 GB" })).toBe(false);
    expect(canRewrite({ caption: "Okay." })).toBe(false);
    expect(canRewrite({ caption: SENT })).toBe(true);
  });
  it("keeps the original wherever a rewrite fails, and counts both", () => {
    const lines = [{ caption: SENT, speech: SENT }, { caption: "The total is ₹14,999 in all.", speech: "x" }, { caption: "Please listen to the summary first.", speech: "y" }];
    const m = mergeRewrites(lines, ["Here is my first pick, the Samsung Galaxy M35 5G at ₹14,999, the cheapest.", "The total comes to ₹12,999 in all.", null], "en");
    expect(m.used).toBe(1);
    expect(m.rejected).toBe(1);
    expect(m.lines[0].caption).toContain("my first pick");
    expect(m.lines[1].caption).toBe("The total is ₹14,999 in all.");
    expect(m.lines[2].caption).toBe("Please listen to the summary first.");
  });
});

describe("a rewrite that drops the meaning is refused", () => {
  it("too short compared with the original", () => {
    expect(rewriteIsSafe("Number 1: Samsung Galaxy M35 5G, ₹14,999. It is the cheapest of these four phones.", "Samsung Galaxy M35 5G, ₹14,999.", "en")).toBe(false);
  });
});
