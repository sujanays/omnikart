import type { ErrorCode } from "@/assistant/errors";
import type { Faults } from "@/assistant/client/store";

/**
 * Every call from the browser to our /api routes goes through here.
 * It adds the judge-page fault switches, enforces a timeout, and turns every failure
 * into a ClientApiError with a code the app knows how to speak about.
 */

export type ClientErrorCode = ErrorCode;

export class ClientApiError extends Error {
  code: ClientErrorCode;
  status: number;
  constructor(code: ClientErrorCode, status = 0, message?: string) {
    super(message ?? code);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
  }
}

const TIMEOUT_MS = 20_000;

export interface CallOptions {
  json?: unknown;
  form?: FormData;
  method?: "POST" | "GET";
}

export async function callApi<T>(path: string, opts: CallOptions, faults: Faults): Promise<T> {
  if (faults.network || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    throw new ClientApiError("network", 0, "offline");
  }
  const headers: Record<string, string> = {};
  const active = (["asr_garble", "groq_429", "tts_fail"] as const).filter((k) => faults[k]);
  if (active.length) headers["x-fault"] = active.join(",");
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? "POST", headers, body, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ClientApiError("timeout", 0);
    throw new ClientApiError("network", 0);
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: ErrorCode; message?: string } } | null)?.error;
    throw new ClientApiError(err?.code ?? "bad_response", res.status, err?.message);
  }
  if (payload === null) throw new ClientApiError("bad_response", res.status, "Empty reply");
  return payload as T;
}
