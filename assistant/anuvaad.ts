import type { Lang } from "@/contract/lang";
import { ApiError } from "@/assistant/errors";
import {
  ANUVAAD_TIMEOUT_MS,
  ASR_MAX_BYTES,
  ASR_MAX_SECONDS_SERVICE,
  DEFAULT_REST_SECONDS,
  GENDER,
  MAX_REST_SECONDS,
  MT_CHUNK_WORDS,
  TTS_MAX_WORDS,
} from "@/assistant/config";
import { withPool, type PoolEntry, type PoolMeta } from "@/assistant/keypool";
import { chunkForMt, wordCount } from "@/assistant/speakable";

/**
 * The only file that talks to AnuvaadHub.
 * Spec: ANUVAADHUB_API_SPECIFICATIONS.pdf
 *   POST <api_endpoint>   header  access-token: <token>
 *   MT   JSON {input_text}               -> data.output_text   (max 50 words)
 *   ASR  form audio_file (wav)           -> data.recognized_text (about 20 s, under 5 MB)
 *   TTS  JSON {text, gender}             -> data.s3_url        (max 30 words, no special characters)
 * Every reply is {status, message, data, error, code}.
 */

export interface Timed<T> {
  value: T;
  meta: PoolMeta;
}

interface Envelope {
  status?: string;
  message?: string;
  data?: Record<string, unknown> | null;
  error?: unknown;
  code?: number;
}

function retryAfterSeconds(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = Number(h);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_REST_SECONDS) : undefined;
}

/** One POST with a timeout. Turns every failure into a named ApiError. */
export async function post(entry: PoolEntry, body: BodyInit, json: boolean): Promise<Record<string, unknown>> {
  if (!entry.url) throw new ApiError("not_configured", "Endpoint URL missing");
  const headers: Record<string, string> = { "access-token": entry.token };
  if (json) headers["content-type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ANUVAAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(entry.url, { method: "POST", headers, body, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new ApiError("timeout", "AnuvaadHub timed out");
    throw new ApiError("network", "Could not reach AnuvaadHub");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new ApiError("rate_limited", "AnuvaadHub rate limit", retryAfterSeconds(res) ?? DEFAULT_REST_SECONDS);
  if (res.status === 401 || res.status === 403) throw new ApiError("auth", `AnuvaadHub refused the token (${res.status})`);

  let env: Envelope;
  try {
    env = (await res.json()) as Envelope;
  } catch {
    throw new ApiError("bad_response", `AnuvaadHub sent a non JSON reply (${res.status})`);
  }

  if (env.code === 429) throw new ApiError("rate_limited", "AnuvaadHub rate limit", DEFAULT_REST_SECONDS);
  if (env.code === 401 || env.code === 403) throw new ApiError("auth", "AnuvaadHub refused the token");
  if (!res.ok || env.status !== "success" || !env.data || typeof env.data !== "object") {
    throw new ApiError("bad_response", `AnuvaadHub error: ${env.message ?? res.status}`);
  }
  return env.data;
}

export function asrPool(lang: Lang): string {
  return `ANUVAAD_ASR_${lang.toUpperCase()}`;
}
export function ttsPool(lang: Lang): string {
  return `ANUVAAD_TTS_${lang.toUpperCase()}`;
}
export function mtPool(from: Lang, to: Lang): string {
  return `ANUVAAD_MT_${from.toUpperCase()}_${to.toUpperCase()}`;
}

/** Read the duration of a 16 bit PCM WAV from its header. Returns null if it is not a WAV we understand. */
export function wavInfo(buf: ArrayBuffer): { seconds: number; sampleRate: number } | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  const sampleRate = v.getUint32(24, true);
  const byteRate = v.getUint32(28, true);
  if (!byteRate) return null;
  return { seconds: (buf.byteLength - 44) / byteRate, sampleRate };
}

/** Speech to text. `wav` must be a WAV under 5 MB and about 20 seconds. */
export async function asr(lang: Lang, wav: ArrayBuffer): Promise<Timed<string>> {
  if (wav.byteLength > ASR_MAX_BYTES) throw new ApiError("too_long", "Audio is over 5 MB");
  const info = wavInfo(wav);
  if (!info) throw new ApiError("bad_input", "Audio is not a WAV file");
  if (info.seconds > ASR_MAX_SECONDS_SERVICE) throw new ApiError("too_long", "Audio is longer than 20 seconds");
  const r = await withPool(asrPool(lang), async (entry) => {
    const fd = new FormData();
    fd.append("audio_file", new Blob([wav], { type: "audio/wav" }), "audio.wav");
    const data = await post(entry, fd, false);
    const text = data.recognized_text;
    if (typeof text !== "string") throw new ApiError("bad_response", "ASR reply has no recognized_text");
    return text.trim();
  });
  if (!r.value) throw new ApiError("empty", "Nothing was recognised");
  return r;
}

/** Translate. Long text is cut into sentence chunks of at most 45 words and put back together. */
export async function translate(from: Lang, to: Lang, text: string): Promise<Timed<string>> {
  const started = Date.now();
  if (from === to || !text.trim()) {
    return { value: text, meta: { key: 0, keys: 0, attempts: 0, rested: [], ms: 0 } };
  }
  const chunks = chunkForMt(text, MT_CHUNK_WORDS);
  const results = await Promise.all(
    chunks.map((chunk) =>
      withPool(mtPool(from, to), async (entry) => {
        const data = await post(entry, JSON.stringify({ input_text: chunk }), true);
        const out = data.output_text;
        if (typeof out !== "string") throw new ApiError("bad_response", "MT reply has no output_text");
        return out.trim();
      }),
    ),
  );
  const joined = results.map((r) => r.value).join(" ").trim();
  if (!joined) throw new ApiError("empty", "Translation came back empty");
  const rested = results.flatMap((r) => r.meta.rested);
  const last = results[results.length - 1].meta;
  return { value: joined, meta: { ...last, rested, ms: Date.now() - started } };
}

/** Text to speech. `text` must already be cleaned and at most 30 words (see splitForSpeech). */
export async function tts(lang: Lang, text: string, gender: "male" | "female" = GENDER): Promise<Timed<string>> {
  const clean = text.trim();
  if (!clean) throw new ApiError("bad_input", "Nothing to say");
  if (wordCount(clean) > TTS_MAX_WORDS) throw new ApiError("too_long", "More than 30 words");
  if (/[^\p{L}\p{M}\p{N}\s]/u.test(clean)) throw new ApiError("bad_input", "Special characters are not allowed");
  const r = await withPool(ttsPool(lang), async (entry) => {
    const data = await post(entry, JSON.stringify({ text: clean, gender }), true);
    const url = data.s3_url;
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      throw new ApiError("bad_response", "TTS reply has no s3_url");
    }
    return url;
  });
  return r;
}
