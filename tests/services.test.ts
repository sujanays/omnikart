import { META } from "./helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPools } from "@/assistant/keypool";
import { asr, translate, tts, wavInfo } from "@/assistant/anuvaad";
import { pickAction } from "@/assistant/groq";

function wav(seconds: number, sampleRate = 16000): ArrayBuffer {
  const dataBytes = Math.floor(seconds * sampleRate * 2);
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, dataBytes, true);
  return buf;
}

const ok = (data: object) =>
  new Response(JSON.stringify({ status: "success", message: "ok", data, error: null, code: 200 }), { status: 200 });

beforeEach(() => {
  resetPools();
  vi.stubEnv("ANUVAAD_ASR_HI_URLS", "https://asr.test/hi");
  vi.stubEnv("ANUVAAD_ASR_HI_TOKENS", "ta1,ta2");
  vi.stubEnv("ANUVAAD_MT_HI_EN_URLS", "https://mt.test/hi-en");
  vi.stubEnv("ANUVAAD_MT_HI_EN_TOKENS", "tm1,tm2");
  vi.stubEnv("ANUVAAD_TTS_EN_URLS", "https://tts.test/en");
  vi.stubEnv("ANUVAAD_TTS_EN_TOKENS", "tt1");
  vi.stubEnv("GROQ_API_KEYS", "g1,g2");
  vi.stubEnv("MOCK_LLM", "0");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetPools();
});

describe("wavInfo", () => {
  it("reads duration and sample rate", () => {
    const i = wavInfo(wav(2))!;
    expect(i.sampleRate).toBe(16000);
    expect(i.seconds).toBeCloseTo(2, 2);
  });
  it("rejects non WAV bytes", () => {
    expect(wavInfo(new ArrayBuffer(100))).toBeNull();
  });
});

describe("AnuvaadHub client", () => {
  it("ASR sends audio_file as form data with the access-token header", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>)["access-token"]).toBe("ta1");
      expect(init!.body).toBeInstanceOf(FormData);
      expect((init!.body as FormData).get("audio_file")).toBeInstanceOf(Blob);
      return ok({ recognized_text: " नमस्ते " });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await asr("hi", wav(2));
    expect(r.value).toBe("नमस्ते");
    expect(fetchMock).toHaveBeenCalledWith("https://asr.test/hi", expect.anything());
  });

  it("ASR refuses over 20 seconds and non WAV without calling the service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(asr("hi", wav(21))).rejects.toMatchObject({ code: "too_long" });
    await expect(asr("hi", new ArrayBuffer(500))).rejects.toMatchObject({ code: "bad_input" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ASR with nothing recognised is an empty error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ recognized_text: "  " })));
    await expect(asr("hi", wav(1))).rejects.toMatchObject({ code: "empty" });
  });

  it("a 429 on the first token moves to the second token", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        const t = (init!.headers as Record<string, string>)["access-token"];
        seen.push(t);
        if (t === "ta1") return new Response("{}", { status: 429, headers: { "retry-after": "5" } });
        return ok({ recognized_text: "ठीक है" });
      }),
    );
    const r = await asr("hi", wav(1));
    expect(r.value).toBe("ठीक है");
    expect(seen).toEqual(["ta1", "ta2"]);
    expect(r.meta.rested).toEqual([1]);
  });

  it("a rate limit inside the body (code 429) is also rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "error", code: 429, message: "slow down" }), { status: 200 })),
    );
    await expect(asr("hi", wav(1))).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("MT splits long text into chunks of 45 words or fewer and joins the results", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        const { input_text } = JSON.parse(init!.body as string);
        bodies.push(input_text);
        return ok({ output_text: `T(${input_text.split(" ").length})` });
      }),
    );
    const text = Array.from({ length: 100 }, () => "शब्द").join(" ");
    const r = await translate("hi", "en", text);
    expect(bodies.length).toBe(3);
    for (const b of bodies) expect(b.split(" ").length).toBeLessThanOrEqual(45);
    expect(r.value).toBe("T(45) T(45) T(10)");
  });

  it("MT with the same language is a no-op and calls nothing", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await translate("en", "en", "hello");
    expect(r.value).toBe("hello");
    expect(f).not.toHaveBeenCalled();
  });

  it("MT with no endpoint configured is not_configured", async () => {
    await expect(translate("en", "te", "hello")).rejects.toMatchObject({ code: "not_configured" });
  });

  it("TTS returns the s3 url and refuses over 30 words or special characters", async () => {
    const f = vi.fn(async () => ok({ s3_url: "https://bucket.s3.amazonaws.com/a.wav" }));
    vi.stubGlobal("fetch", f);
    const r = await tts("en", "hello there");
    expect(r.value).toBe("https://bucket.s3.amazonaws.com/a.wav");
    await expect(tts("en", Array.from({ length: 31 }, () => "w").join(" "))).rejects.toMatchObject({ code: "too_long" });
    await expect(tts("en", "price ₹5!")).rejects.toMatchObject({ code: "bad_input" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("TTS reply without a url is a bad_response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({})));
    await expect(tts("en", "hello")).rejects.toMatchObject({ code: "bad_response" });
  });

  it("a network failure is a named network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(tts("en", "hello")).rejects.toMatchObject({ code: "network" });
  });
});

describe("Groq client: pickAction", () => {
  const kw = { hasProduct: false, optionCount: 0 };
  const groqReply = (action: object) =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(action) } }] }), { status: 200 });
  const full = (o: object) => ({
    action: "search", category: null, max_price: null, min_rating: null, keywords: null, sort: null,
    pick: null, pick2: null, quantity: null, payment: null, question: null, clarify: null, ...o,
  });

  it("returns a validated action from the primary model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        const body = JSON.parse(init!.body as string);
        expect(body.model).toBe("openai/gpt-oss-120b");
        expect(body.response_format.json_schema.strict).toBe(true);
        return groqReply(full({ category: "cookers", max_price: 1500, keywords: "cooker" }));
      }),
    );
    const r = await pickAction("STATE", "cooker under 1500", kw, META.categories);
    expect(r.source).toBe("groq");
    expect(r.action).toMatchObject({ action: "search", category: "cookers", max_price: 1500 });
  });

  it("a 429 on one key goes to the next key on the same model", async () => {
    const keys: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        const k = (init!.headers as Record<string, string>).authorization;
        keys.push(k);
        if (k === "Bearer g1") return new Response("{}", { status: 429, headers: { "retry-after": "5" } });
        return groqReply(full({ action: "read_cart" }));
      }),
    );
    const r = await pickAction("STATE", "what is in my cart", kw, META.categories);
    expect(r.source).toBe("groq");
    expect(r.model).toBe("openai/gpt-oss-120b");
    expect(keys).toEqual(["Bearer g1", "Bearer g2"]);
  });

  it("every key limited on the primary falls to the secondary model, then to keywords", async () => {
    const models: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        models.push(JSON.parse(init!.body as string).model);
        return new Response("{}", { status: 429, headers: { "retry-after": "5" } });
      }),
    );
    const r = await pickAction("STATE", "cooker under 1500 rupees", kw, META.categories);
    expect(r.source).toBe("keyword");
    expect(r.reason).toBe("rate_limited");
    expect(r.action).toMatchObject({ action: "search", category: "cookers", max_price: 1500 });
    // the primary model was tried before the secondary was
    expect(models[0]).toBe("openai/gpt-oss-120b");
  });

  it("garbage from the model falls back to keywords", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => groqReply({ action: "launch_rocket" })));
    const r = await pickAction("STATE", "show me phones", kw, META.categories);
    expect(r.source).toBe("keyword");
    expect(r.action.category).toBe("phones");
  });

  it("an unknown action from the model never reaches the app", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => groqReply(full({ action: "place_order" }))));
    const r = await pickAction("STATE", "yes place order", kw, META.categories);
    expect(r.source).toBe("keyword");
    expect(r.action.action).not.toBe("place_order");
  });

  it("the injected fault behaves like a real rate limit and recovers right after", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await pickAction("STATE", "show me phones", kw, META.categories, { fault429: true });
    expect(r.source).toBe("keyword");
    expect(f).not.toHaveBeenCalled();
  });

  it("'my order' tracks the order, as the order confirmation tells the shopper to say", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const r = await pickAction("STATE", "my order", kw, META.categories);
    expect(r.action.action).toBe("track_order");
  });

  it("MOCK_LLM=1 never calls the network", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await pickAction("STATE", "show me phones", kw, META.categories);
    expect(r.source).toBe("mock");
    expect(f).not.toHaveBeenCalled();
  });

  it("no keys configured goes straight to keywords", async () => {
    vi.stubEnv("GROQ_API_KEYS", "");
    resetPools();
    const r = await pickAction("STATE", "show me phones", kw, META.categories);
    expect(r.source).toBe("keyword");
    expect(r.reason).toBe("not_configured");
  });

  it("retries without reasoning_effort if the API refuses it", async () => {
    let first = true;
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        const b = JSON.parse(init!.body as string);
        bodies.push(b);
        if (first && "reasoning_effort" in b) {
          first = false;
          return new Response("unsupported parameter: reasoning_effort", { status: 400 });
        }
        return groqReply(full({ action: "help" }));
      }),
    );
    const r = await pickAction("STATE", "help", kw, META.categories);
    expect(r.source).toBe("groq");
    expect(bodies.length).toBe(2);
    expect("reasoning_effort" in bodies[1]).toBe(false);
  });
});
