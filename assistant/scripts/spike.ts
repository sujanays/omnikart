/**
 * Step P1-0. Calls every AnuvaadHub endpoint and every Groq key once and prints what happened.
 *   npm run spike
 *
 * It answers the questions the plan leaves open:
 *   - which endpoints and keys actually work, and how long each call takes
 *   - does text to speech read digits and punctuation well?  (it saves WAV files for you to LISTEN to)
 *   - does speech recognition understand what text to speech just said?  (a round trip, per language)
 *   - what are the real Groq rate limits for your keys?  (read from the response headers)
 * Results are also written to .gstack/spike/spike-results.json
 */
import fs from "node:fs";
import path from "node:path";
import { LANGS, type Lang } from "@/contract/lang";
import { buildPool, type PoolEntry } from "@/assistant/keypool";
import { asrPool, mtPool, post, ttsPool, wavInfo } from "@/assistant/anuvaad";
import { callOnce, models } from "@/assistant/groq";

const OUT = path.resolve(import.meta.dirname, "..", "..", ".gstack", "spike");
fs.mkdirSync(OUT, { recursive: true });

interface Row {
  service: string;
  key: string;
  ok: boolean;
  ms: number;
  note: string;
}
const rows: Row[] = [];
const results: Record<string, unknown> = {};

function record(service: string, key: string, ok: boolean, ms: number, note: string) {
  rows.push({ service, key, ok, ms, note });
  console.log(`${ok ? "  OK  " : " FAIL "} ${service.padEnd(18)} key ${key.padEnd(7)} ${String(ms).padStart(5)} ms  ${note}`);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ v?: T; ms: number; err?: string }> {
  const t0 = Date.now();
  try {
    return { v: await fn(), ms: Date.now() - t0 };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "error";
    return { ms: Date.now() - t0, err: `${code}: ${(e as Error).message}` };
  }
}

const label = (e: PoolEntry) => `${e.n}/${e.total}`;

/* ---------------- machine translation ---------------- */
const MT_TESTS: [Lang, Lang, string][] = [
  ["en", "hi", "Hello, how are you? The cooker costs 1299 rupees."],
  ["hi", "en", "नमस्ते, आप कैसे हैं? कुकर की कीमत 1299 रुपये है।"],
  ["en", "te", "Hello, how are you? The cooker costs 1299 rupees."],
  ["te", "en", "నమస్కారం, మీరు ఎలా ఉన్నారు? కుక్కర్ ధర 1299 రూపాయలు."],
];

async function testMt() {
  console.log("\nMachine translation (limit 50 words)");
  for (const [from, to, text] of MT_TESTS) {
    const pool = buildPool(mtPool(from, to));
    if (pool.size === 0) {
      console.log(` skip  ${mtPool(from, to)} not configured`);
      continue;
    }
    for (const e of pool.all()) {
      const r = await timed(async () => {
        const data = await post(e, JSON.stringify({ input_text: text }), true);
        return String(data.output_text ?? "");
      });
      record(mtPool(from, to), label(e), !r.err, r.ms, r.err ?? JSON.stringify(r.v));
      if (!r.err) results[`mt_${from}_${to}`] = r.v;
    }
  }
}

/* ---------------- text to speech ---------------- */
const TTS_SENTENCES: Record<Lang, { tag: string; text: string }[]> = {
  en: [
    { tag: "plain", text: "Welcome to Omnikart. Tell me what you want to buy." },
    { tag: "digits", text: "The total is 1299 rupees." },
    { tag: "words", text: "The total is one thousand two hundred ninety nine rupees." },
    { tag: "punct", text: "Cooker, steel, three litres. Price: one thousand, rated four point three." },
    { tag: "thirty", text: Array.from({ length: 30 }, () => "hello").join(" ") },
  ],
  hi: [
    { tag: "plain", text: "ओम्नीकार्ट में आपका स्वागत है। बताइए क्या खरीदना है।" },
    { tag: "digits", text: "कुल कीमत 1299 रुपये है।" },
    { tag: "words", text: "कुल कीमत एक हज़ार दो सौ निन्यानवे रुपये है।" },
    { tag: "punct", text: "कुकर, स्टील, तीन लीटर। कीमत: एक हज़ार, रेटिंग चार दशमलव तीन।" },
  ],
  te: [
    { tag: "plain", text: "ఓమ్నీకార్ట్‌కు స్వాగతం. మీరు ఏమి కొనాలనుకుంటున్నారో చెప్పండి." },
    { tag: "digits", text: "మొత్తం ధర 1299 రూపాయలు." },
    { tag: "words", text: "మొత్తం ధర వెయ్యి రెండు వందల తొంభై తొమ్మిది రూపాయలు." },
    { tag: "punct", text: "కుక్కర్, స్టీల్, మూడు లీటర్లు. ధర: వెయ్యి, రేటింగ్ నాలుగు పాయింట్ మూడు." },
  ],
};

async function download(url: string, file: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

async function testTts() {
  console.log("\nText to speech (limit 30 words, no special characters). WAV files are saved so you can listen.");
  for (const lang of LANGS) {
    const pool = buildPool(ttsPool(lang));
    if (pool.size === 0) {
      console.log(` skip  ${ttsPool(lang)} not configured`);
      continue;
    }
    // every key says the plain sentence
    for (const e of pool.all()) {
      const r = await timed(async () => String((await post(e, JSON.stringify({ text: TTS_SENTENCES[lang][0].text.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " "), gender: "female" }), true)).s3_url ?? ""));
      record(ttsPool(lang), label(e), !r.err && r.v!.startsWith("http"), r.ms, r.err ?? "got a url");
    }
    // the first key says the tricky ones
    const e = pool.all()[0];
    for (const t of TTS_SENTENCES[lang]) {
      if (t.tag === "plain") continue;
      const sent = t.tag === "thirty" || t.tag === "digits" ? t.text.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ") : t.text;
      const r = await timed(async () => {
        const data = await post(e, JSON.stringify({ text: sent, gender: "female" }), true);
        const url = String(data.s3_url ?? "");
        const file = path.join(OUT, `tts-${lang}-${t.tag}.wav`);
        const bytes = await download(url, file);
        const info = wavInfo(fs.readFileSync(file).buffer.slice(0) as ArrayBuffer);
        return `${bytes} bytes${info ? `, ${info.seconds.toFixed(1)} s, ${info.sampleRate} Hz` : ""}`;
      });
      record(`${ttsPool(lang)} ${t.tag}`, label(e), !r.err, r.ms, r.err ?? `${r.v} -> ${path.relative(process.cwd(), path.join(OUT, `tts-${lang}-${t.tag}.wav`))}`);
    }
    // the 31 word refusal, to learn how the service says no
    const over = Array.from({ length: 31 }, () => "word").join(" ");
    const r = await timed(async () => post(e, JSON.stringify({ text: over, gender: "female" }), true));
    record(`${ttsPool(lang)} 31 words`, label(e), !!r.err, r.ms, r.err ? `refused as expected (${r.err.slice(0, 80)})` : "ACCEPTED 31 words: our 30 word guard is stricter than the service");
  }
  console.log("\n  >>> Open the files in .gstack/spike/ and listen to the 'digits' and 'punct' ones.");
  console.log("  >>> If digits sound wrong, keep NEXT_PUBLIC_TTS_DIGITS=words (the default). If they sound right you may set it to digits.");
}

/* ---------------- speech recognition: round trip ---------------- */
async function testAsr() {
  console.log("\nSpeech recognition (about 20 seconds, under 5 MB). Each language hears what text to speech just said.");
  for (const lang of LANGS) {
    const pool = buildPool(asrPool(lang));
    if (pool.size === 0) {
      console.log(` skip  ${asrPool(lang)} not configured`);
      continue;
    }
    const wavPath = path.join(OUT, `tts-${lang}-words.wav`);
    if (!fs.existsSync(wavPath)) {
      console.log(` skip  ${asrPool(lang)}: no WAV to listen to (text to speech for ${lang} is not configured). Put any WAV at ${wavPath}`);
      continue;
    }
    const wav = fs.readFileSync(wavPath);
    for (const e of pool.all()) {
      const r = await timed(async () => {
        const fd = new FormData();
        fd.append("audio_file", new Blob([wav], { type: "audio/wav" }), "a.wav");
        return String((await post(e, fd, false)).recognized_text ?? "");
      });
      record(asrPool(lang), label(e), !r.err, r.ms, r.err ?? `heard: ${JSON.stringify(r.v)}`);
      if (!r.err) results[`asr_${lang}`] = r.v;
    }
    console.log(`        said:  ${JSON.stringify(TTS_SENTENCES[lang].find((t) => t.tag === "words")?.text)}`);
  }
}

/* ---------------- Groq ---------------- */
async function testGroq() {
  console.log("\nGroq (every key, then the real rate limits)");
  const pool = buildPool("GROQ");
  if (pool.size === 0) {
    console.log(" skip  GROQ not configured (GROQ_API_KEYS)");
    return;
  }
  const schema = { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } };
  for (const model of [models().primary, models().secondary]) {
    for (const e of pool.all()) {
      const r = await timed(() => callOnce(e, { model, system: 'Reply with {"ok": true}.', user: "ping", schemaName: "ping", schema, maxTokens: 200 }, true));
      record(`groq ${model.split("/").pop()}`, label(e), !r.err, r.ms, r.err ?? "structured JSON ok");
    }
  }
  // headers show the limits that apply to YOUR account
  const e = pool.all()[0];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${e.token}` },
    body: JSON.stringify({ model: models().primary, max_completion_tokens: 20, messages: [{ role: "user", content: "hi" }] }),
  });
  const h = Object.fromEntries([...res.headers.entries()].filter(([k]) => k.startsWith("x-ratelimit") || k === "retry-after"));
  console.log("  rate limit headers for key 1:", JSON.stringify(h));
  results.groq_limits = h;
}

/* ---------------- run ---------------- */
async function main() {
  console.log("Omnikart spike test. This calls your real services once each.\n");
  await testMt();
  await testTts();
  await testAsr();
  await testGroq();

  if (rows.length === 0) {
    console.log("\nNothing is configured yet. Copy .env.example to .env.local, fill in the endpoint URLs and tokens from AnuvaadHub and your Groq keys, then run this again.");
    return;
  }
  const failed = rows.filter((r) => !r.ok);
  const slow = rows.filter((r) => r.ms > 5000);
  console.log("\n=== Summary ===");
  console.log(`${rows.length - failed.length} of ${rows.length} calls worked.`);
  if (failed.length) console.log("Failed:", failed.map((f) => `${f.service} key ${f.key}`).join("; "));
  if (slow.length) console.log("Slower than 5 s (move the voice pack earlier in the plan):", slow.map((f) => `${f.service} ${f.ms} ms`).join("; "));
  fs.writeFileSync(path.join(OUT, "spike-results.json"), JSON.stringify({ at: new Date().toISOString(), rows, results }, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), path.join(OUT, "spike-results.json"))}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
