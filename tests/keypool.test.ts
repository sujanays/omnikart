import { describe, expect, it } from "vitest";
import { Pool, buildPool, parseList, withPool } from "@/assistant/keypool";
import { ApiError } from "@/assistant/errors";

describe("parseList", () => {
  it("splits, trims and drops empties", () => {
    expect(parseList(" a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(parseList(undefined)).toEqual([]);
    expect(parseList("")).toEqual([]);
  });
});

describe("Pool", () => {
  it("rotates round robin", () => {
    const p = new Pool("T", ["k1", "k2", "k3"]);
    expect([1, 2, 3, 4, 5].map(() => p.take()!.n)).toEqual([1, 2, 3, 1, 2]);
  });

  it("skips a resting key until its time is up", () => {
    const p = new Pool("T", ["k1", "k2", "k3"]);
    p.rest(2, 60, 1000);
    const seen = [p.take(1000)!.n, p.take(1000)!.n, p.take(1000)!.n, p.take(1000)!.n];
    expect(seen).not.toContain(2);
    // after the rest is over key 2 is back
    const later = [p.take(62_000)!.n, p.take(62_000)!.n, p.take(62_000)!.n];
    expect(later.sort()).toEqual([1, 2, 3]);
  });

  it("returns null when every key is resting", () => {
    const p = new Pool("T", ["k1", "k2"]);
    p.rest(1, 60, 0);
    p.rest(2, 60, 0);
    expect(p.take(1000)).toBeNull();
    expect(p.status(1000)).toMatchObject({ total: 2, healthy: 0, resting: 2 });
  });

  it("one shared URL is reused for every token", () => {
    const p = new Pool("T", ["a", "b", "c", "d"], ["https://x/y"]);
    expect(p.size).toBe(4);
    expect(p.take()!.url).toBe("https://x/y");
  });

  it("mismatched lists are cut to the shorter one and flagged", () => {
    const p = new Pool("T", ["a", "b", "c"], ["u1", "u2"]);
    expect(p.size).toBe(2);
    expect(p.issue).toMatch(/2 URLs but 3 tokens/);
  });

  it("an empty pool has size zero", () => {
    expect(new Pool("T", []).size).toBe(0);
  });
});

describe("buildPool", () => {
  it("reads GROQ_API_KEYS", () => {
    const p = buildPool("GROQ", { GROQ_API_KEYS: "g1,g2,g3" });
    expect(p.size).toBe(3);
  });
  it("reads NAME_URLS and NAME_TOKENS", () => {
    const p = buildPool("ANUVAAD_ASR_EN", {
      ANUVAAD_ASR_EN_URLS: "https://a",
      ANUVAAD_ASR_EN_TOKENS: "t1,t2",
    });
    const e = p.take()!;
    expect(e).toMatchObject({ url: "https://a", token: "t1", n: 1, total: 2 });
  });
});

describe("withPool", () => {
  it("returns the first success and reports which key answered", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    const r = await withPool("T", async (e) => `ok-${e.n}`, { pool: p });
    expect(r.value).toBe("ok-1");
    expect(r.meta).toMatchObject({ key: 1, keys: 2, attempts: 1, rested: [] });
  });

  it("a 429 rests that key and moves to the next at once", async () => {
    const p = new Pool("T", ["k1", "k2", "k3"]);
    const r = await withPool(
      "T",
      async (e) => {
        if (e.n === 1) throw new ApiError("rate_limited", "x", 30);
        return `ok-${e.n}`;
      },
      { pool: p },
    );
    expect(r.value).toBe("ok-2");
    expect(r.meta.rested).toEqual([1]);
    expect(p.status().resting).toBe(1);
  });

  it("a bad token rests the key and moves on", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    const r = await withPool(
      "T",
      async (e) => {
        if (e.n === 1) throw new ApiError("auth");
        return e.n;
      },
      { pool: p },
    );
    expect(r.value).toBe(2);
    expect(r.meta.rested).toEqual([1]);
  });

  it("a timeout tries the next key without resting the first", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    const r = await withPool(
      "T",
      async (e) => {
        if (e.n === 1) throw new ApiError("timeout");
        return e.n;
      },
      { pool: p },
    );
    expect(r.value).toBe(2);
    expect(p.status().resting).toBe(0);
  });

  it("stops at once on an error another key cannot fix", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    let calls = 0;
    await expect(
      withPool(
        "T",
        async () => {
          calls++;
          throw new ApiError("bad_response");
        },
        { pool: p },
      ),
    ).rejects.toMatchObject({ code: "bad_response" });
    expect(calls).toBe(1);
  });

  it("throws rate_limited when every key is rate limited", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    await expect(
      withPool(
        "T",
        async () => {
          throw new ApiError("rate_limited", "x", 30);
        },
        { pool: p },
      ),
    ).rejects.toMatchObject({ code: "rate_limited" });
    // and the next call fails fast without calling the service
    let called = false;
    await expect(
      withPool(
        "T",
        async () => {
          called = true;
          return 1;
        },
        { pool: p },
      ),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(called).toBe(false);
  });

  it("not_configured when the pool is empty", async () => {
    await expect(withPool("T", async () => 1, { pool: new Pool("T", []) })).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("does not swallow programming errors", async () => {
    const p = new Pool("T", ["k1", "k2"]);
    await expect(
      withPool(
        "T",
        async () => {
          throw new TypeError("bug");
        },
        { pool: p },
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("never puts a key value in the metadata", async () => {
    const p = new Pool("T", ["secret-key-value"]);
    const r = await withPool("T", async () => 1, { pool: p });
    expect(JSON.stringify(r.meta)).not.toContain("secret");
  });
});
