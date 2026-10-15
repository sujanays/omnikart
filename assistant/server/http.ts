import { isLang, type Lang } from "@/contract/lang";
import { ApiError, isApiError, type ErrorCode } from "@/assistant/errors";
import type { PoolMeta } from "@/assistant/keypool";

/** Helpers shared by every /api route. */

const STATUS: Record<ErrorCode, number> = {
  timeout: 504,
  rate_limited: 429,
  auth: 502,
  network: 502,
  bad_response: 502,
  empty: 422,
  too_long: 413,
  bad_input: 400,
  not_configured: 503,
  invalid_json: 502,
  refused: 502,
  fault: 503,
};

/** Turn any error into a JSON failure. Only named ApiErrors are expected; anything else is a bug and says so. */
export function fail(e: unknown): Response {
  if (isApiError(e)) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: STATUS[e.code] });
  }
  console.error("[api] unexpected error", e);
  return Response.json({ error: { code: "bad_response", message: "Unexpected server error" } }, { status: 500 });
}

/** Names of the judge-page fault switches that are on for this request. */
export type Fault = "network" | "asr_garble" | "groq_429" | "tts_fail";
export function faultsOf(req: Request): Set<Fault> {
  if (process.env.ALLOW_FAULTS === "0") return new Set();
  const raw = req.headers.get("x-fault") ?? "";
  const ok: Fault[] = ["network", "asr_garble", "groq_429", "tts_fail"];
  return new Set(raw.split(",").map((s) => s.trim()).filter((s): s is Fault => (ok as string[]).includes(s)));
}

export function metaForClient(meta?: PoolMeta, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return meta ? { key: meta.key, keys: meta.keys, rested: meta.rested, ms: meta.ms, attempts: meta.attempts, ...extra } : extra;
}

export function readLang(v: unknown, name = "lang"): Lang {
  if (!isLang(v)) throw new ApiError("bad_input", `${name} must be en, hi or te`);
  return v;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError("bad_input", "Body must be a JSON object");
  }
}

export function readText(v: unknown, name: string, maxChars: number): string {
  if (typeof v !== "string") throw new ApiError("bad_input", `${name} must be text`);
  const t = v.trim();
  if (!t) throw new ApiError("bad_input", `${name} is empty`);
  if (t.length > maxChars) throw new ApiError("too_long", `${name} is longer than ${maxChars} characters`);
  return t;
}
