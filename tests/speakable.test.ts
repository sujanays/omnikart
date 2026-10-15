import { describe, expect, it } from "vitest";
import {
  chunkForMt,
  cleanForTts,
  digitsToWords,
  normalizeDigits,
  numberToWords,
  numbersPreserved,
  spellDigits,
  splitForSpeech,
  wordCount,
} from "@/assistant/speakable";

describe("numberToWords", () => {
  it("english, Indian grouping", () => {
    expect(numberToWords(0, "en")).toBe("zero");
    expect(numberToWords(21, "en")).toBe("twenty one");
    expect(numberToWords(1299, "en")).toBe("one thousand two hundred ninety nine");
    expect(numberToWords(150000, "en")).toBe("one lakh fifty thousand");
    expect(numberToWords(4.3, "en")).toBe("four point three");
  });
  it("hindi", () => {
    expect(numberToWords(1500, "hi")).toBe("एक हज़ार पाँच सौ");
    expect(numberToWords(99, "hi")).toBe("निन्यानवे");
    expect(numberToWords(4.5, "hi")).toBe("चार दशमलव पाँच");
  });
  it("telugu", () => {
    expect(numberToWords(21, "te")).toBe("ఇరవై ఒకటి");
    expect(numberToWords(100, "te")).toBe("వంద");
    expect(numberToWords(1000, "te")).toBe("వెయ్యి");
    expect(numberToWords(1500, "te")).toBe("వెయ్యి ఐదు వందల");
  });
  it("accepts devanagari digits and commas", () => {
    expect(numberToWords("१,२९९", "en")).toBe("one thousand two hundred ninety nine");
  });
  it("leaves non numbers alone", () => {
    expect(numberToWords("abc", "en")).toBe("abc");
  });
  it("spells long numbers and leading zeros digit by digit", () => {
    expect(numberToWords("1234567890", "en")).toBe(
      "one two three four five six seven eight nine zero",
    );
    expect(numberToWords("007", "en")).toBe("zero zero seven");
  });
});

describe("spellDigits / digitsToWords", () => {
  it("spells an order number digit by digit", () => {
    expect(spellDigits("407", "en")).toBe("four zero seven");
  });
  it("replaces numbers inside a sentence, drops thousands commas", () => {
    expect(digitsToWords("Total 1,299 rupees, 2 items", "en")).toBe(
      "Total one thousand two hundred ninety nine rupees, two items",
    );
  });
  it("normalizeDigits", () => {
    expect(normalizeDigits("౧౨ ३४")).toBe("12 34");
  });
});

describe("cleanForTts", () => {
  it("removes special characters but keeps letters of every script", () => {
    const out = cleanForTts("Price: ₹1,299 (best!) — don't miss", "en");
    expect(out).toBe("Price one thousand two hundred ninety nine rupees best dont miss");
    expect(out).not.toMatch(/[^\p{L}\p{M}\p{N}\s]/u);
  });
  it("keeps Hindi vowel signs", () => {
    expect(cleanForTts("यह कुकर बहुत अच्छा है।", "hi")).toBe("यह कुकर बहुत अच्छा है");
  });
  it("digits mode keeps digits but drops thousands commas", () => {
    expect(cleanForTts("Total ₹1,299", "en", "digits")).toBe("Total 1299 rupees");
  });
});

describe("splitForSpeech", () => {
  it("never returns a chunk over the limit", () => {
    const long = Array.from({ length: 120 }, () => "word").join(" ") + ".";
    for (const max of [25, 15]) {
      const chunks = splitForSpeech(long, "en", max);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) expect(wordCount(c)).toBeLessThanOrEqual(max);
    }
  });
  it("splits sentence by sentence and packs short ones together", () => {
    const chunks = splitForSpeech("First one. Second one. Third one.", "en", 25);
    expect(chunks).toEqual(["First one Second one Third one"]);
  });
  it("breaks a long sentence at commas before cutting words", () => {
    const a = Array.from({ length: 15 }, () => "alpha").join(" ");
    const b = Array.from({ length: 15 }, () => "beta").join(" ");
    const chunks = splitForSpeech(`${a}, ${b}.`, "en", 20);
    expect(chunks).toEqual([a, b]);
  });
  it("splits at the Hindi danda", () => {
    const chunks = splitForSpeech("पहला वाक्य। दूसरा वाक्य।", "hi", 2);
    expect(chunks).toEqual(["पहला वाक्य", "दूसरा वाक्य"]);
  });
  it("counts words after numbers become words", () => {
    // "1299" becomes 5 words, so a limit of 4 must split it further
    const chunks = splitForSpeech("1299", "en", 4);
    for (const c of chunks) expect(wordCount(c)).toBeLessThanOrEqual(4);
  });
  it("returns nothing for empty or symbol only text", () => {
    expect(splitForSpeech("", "en")).toEqual([]);
    expect(splitForSpeech("!!! ???", "en")).toEqual([]);
  });
});

describe("chunkForMt", () => {
  it("keeps every chunk at 45 words or fewer", () => {
    const text = Array.from({ length: 200 }, () => "w").join(" ");
    for (const c of chunkForMt(text)) expect(wordCount(c)).toBeLessThanOrEqual(45);
  });
  it("does not touch punctuation", () => {
    expect(chunkForMt("Price is Rs. 1,299.")).toEqual(["Price is Rs. 1,299."]);
  });
});

describe("numbersPreserved", () => {
  it("accepts a faithful translation", () => {
    expect(numbersPreserved("Cooker, 1299 rupees, 4.3 stars", "कुकर, 1299 रुपये, 4.3 सितारे")).toBe(true);
  });
  it("accepts digits written in another script", () => {
    expect(numbersPreserved("Only 3 left", "सिर्फ़ ३ बचे हैं")).toBe(true);
  });
  it("rejects a changed number", () => {
    expect(numbersPreserved("Price 1299", "कीमत 1399")).toBe(false);
  });
  it("rejects a dropped number", () => {
    expect(numbersPreserved("Price 1299 and 3 left", "कीमत 1299")).toBe(false);
  });
  it("protects size tokens", () => {
    expect(numbersPreserved("Available in XL", "XL में उपलब्ध")).toBe(true);
    expect(numbersPreserved("Available in XL", "बड़े में उपलब्ध")).toBe(false);
  });
});

describe("product text for the voice", () => {
  it("English: units are words and letters stay apart from digits", () => {
    expect(cleanForTts("Battery: 6000 mAh", "en")).toBe("Battery six thousand milliamp hours");
    expect(cleanForTts("Samsung Galaxy M35 5G (6 GB RAM, 128 GB)", "en")).toBe("Samsung Galaxy M thirty five five G six gigabytes RAM one hundred twenty eight gigabytes");
    expect(cleanForTts("Redmi A4 and Galaxy A15", "en")).toBe("Redmi A four and Galaxy A fifteen");
  });
  it("Telugu: a hundred followed by more is 'నూట'", () => {
    expect(numberToWords(128, "te")).toBe("నూట ఇరవై ఎనిమిది");
    expect(numberToWords(100, "te")).toBe("వంద");
    expect(numberToWords(1475, "te")).toBe("వెయ్యి నాలుగు వందల డెబ్బై ఐదు");
  });
  it("Hindi and Telugu are untouched by the English rules", () => {
    expect(cleanForTts("6000 एमएएच", "hi")).toBe("छह हज़ार एमएएच");
  });
});
