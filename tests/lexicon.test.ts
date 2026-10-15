import { describe, expect, it } from "vitest";
import { checkConfirm, detectLanguageCommand, has, matchCommand, tokenize } from "@/assistant/lexicon";

describe("tokenize", () => {
  it("lowercases, drops punctuation and apostrophes, keeps Indic marks", () => {
    expect(tokenize("Don't, STOP!")).toEqual(["dont", "stop"]);
    expect(tokenize("हाँ, ऑर्डर करो।")).toEqual(["हाँ", "ऑर्डर", "करो"]);
  });
  it("turns Devanagari digits into ASCII", () => {
    expect(tokenize("१५००")).toEqual(["1500"]);
  });
});

describe("matchCommand", () => {
  it("matches short bare commands in each language", () => {
    expect(matchCommand("yes", "en")).toBe("yes");
    expect(matchCommand("repeat", "en")).toBe("repeat");
    expect(matchCommand("slow down", "en")).toBe("slower");
    expect(matchCommand("हाँ", "hi")).toBe("yes");
    expect(matchCommand("धीरे बोलो", "hi")).toBe("slower");
    expect(matchCommand("avunu", "te")).toBe("yes");
    expect(matchCommand("నెమ్మదిగా", "te")).toBe("slower");
    expect(matchCommand("ఆపండి", "te")).toBe("stop");
  });

  it("does not hijack longer sentences", () => {
    expect(matchCommand("yes show me the second cooker please", "en")).toBeNull();
    expect(matchCommand("repeat the price of the first phone", "en")).toBeNull();
  });

  it("ordinals only count when options are on offer", () => {
    expect(matchCommand("first", "en", { hasOptions: false })).toBeNull();
    expect(matchCommand("first", "en", { hasOptions: true })).toBe("first");
    expect(matchCommand("दूसरा", "hi", { hasOptions: true })).toBe("second");
    expect(matchCommand("మూడవది", "te", { hasOptions: true })).toBe("third");
  });

  it("understands 'go back' and 'where am i'", () => {
    expect(matchCommand("go back", "en")).toBe("back");
    expect(matchCommand("where am i", "en")).toBe("whereami");
  });

  it("returns null for empty text and shopping sentences", () => {
    expect(matchCommand("", "en")).toBeNull();
    expect(matchCommand("pressure cooker", "en")).toBeNull();
  });
});

describe("has", () => {
  it("matches whole words only", () => {
    expect(has("number one", "no", "en")).toBe(false);
    expect(has("no thanks", "no", "en")).toBe(true);
  });
  it("English words are understood inside Hindi and Telugu speech", () => {
    expect(has("ok", "yes", "hi")).toBe(true);
    expect(has("cancel", "cancel", "te")).toBe(true);
  });
});

describe("checkConfirm: the only way to place an order by voice", () => {
  it("accepts a yes together with an order word", () => {
    expect(checkConfirm("Yes, place order", "en")).toBe("confirm");
    expect(checkConfirm("yes order it", "en")).toBe("confirm");
    expect(checkConfirm("हाँ, ऑर्डर करो", "hi")).toBe("confirm");
    expect(checkConfirm("haan order kar do", "hi")).toBe("confirm");
    expect(checkConfirm("అవును ఆర్డర్ చేయండి", "te")).toBe("confirm");
  });

  it("a bare yes, ok or maybe never confirms", () => {
    for (const s of ["yes", "ok", "okay", "maybe", "sure", "hmm", "हाँ", "అవును", ""]) {
      expect(checkConfirm(s, s === "हाँ" ? "hi" : s === "అవును" ? "te" : "en")).not.toBe("confirm");
    }
  });

  it("an order word alone never confirms", () => {
    expect(checkConfirm("place order", "en")).toBe("other");
    expect(checkConfirm("order", "en")).toBe("other");
  });

  it("any negative wins, even next to yes and order", () => {
    expect(checkConfirm("yes but do not place order", "en")).toBe("cancel");
    expect(checkConfirm("no don't order", "en")).toBe("cancel");
    expect(checkConfirm("cancel", "en")).toBe("cancel");
    expect(checkConfirm("नहीं ऑर्डर मत करो", "hi")).toBe("cancel");
    expect(checkConfirm("వద్దు", "te")).toBe("cancel");
  });
});

describe("detectLanguageCommand", () => {
  it("switches both languages", () => {
    expect(detectLanguageCommand("speak Hindi")).toEqual({ lang: "hi", replyOnly: false });
    expect(detectLanguageCommand("हिंदी")).toEqual({ lang: "hi", replyOnly: false });
    expect(detectLanguageCommand("తెలుగు")).toEqual({ lang: "te", replyOnly: false });
  });
  it("reply in X changes only the reply language", () => {
    expect(detectLanguageCommand("reply in Telugu")).toEqual({ lang: "te", replyOnly: true });
    expect(detectLanguageCommand("जवाब हिंदी में दो")).toEqual({ lang: "hi", replyOnly: true });
  });
  it("ignores long sentences and sentences without a language", () => {
    expect(detectLanguageCommand("show me a three litre pressure cooker made in india please now")).toBeNull();
    expect(detectLanguageCommand("show me phones")).toBeNull();
  });
});

describe("commands for the guided journey", () => {
  it("skip, in three languages", () => {
    for (const [t, lang] of [["skip", "en"], ["skip this", "en"], ["any", "en"], ["doesn't matter", "en"], ["छोड़ो", "hi"], ["कोई भी", "hi"], ["వదిలేయండి", "te"]] as const) {
      expect(matchCommand(t, lang), t).toBe("skip");
    }
  });
  it("change the filters, in three languages", () => {
    for (const [t, lang] of [["change filters", "en"], ["filters", "en"], ["फ़िल्टर बदलो", "hi"], ["ఫిల్టర్లు మార్చండి", "te"]] as const) {
      expect(matchCommand(t, lang), t).toBe("filters");
    }
  });
  it("a sentence that merely contains the word skip is not a command", () => {
    expect(matchCommand("please do not skip the samsung phones for me", "en")).toBeNull();
  });
});
