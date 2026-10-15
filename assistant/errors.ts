/**
 * Every outside call fails with one of these named errors. No catch-alls.
 *  timeout        the service did not answer in time
 *  rate_limited   HTTP 429 (or the same code in the body)
 *  auth           HTTP 401/403, the key or token is wrong
 *  network        the request never reached the service
 *  bad_response   the service answered, but not in the documented shape
 *  empty          the service answered with no usable content
 *  too_long       our own input guard: more words or seconds than the service allows
 *  bad_input      the browser sent something we refuse to forward
 *  not_configured no endpoint or key in the environment for this job
 *  invalid_json   the LLM did not return valid JSON for our schema
 *  refused        the LLM refused
 *  fault          a deliberate failure from a judge-page fault switch
 */
export type ErrorCode =
  | "timeout"
  | "rate_limited"
  | "auth"
  | "network"
  | "bad_response"
  | "empty"
  | "too_long"
  | "bad_input"
  | "not_configured"
  | "invalid_json"
  | "refused"
  | "fault";

export class ApiError extends Error {
  code: ErrorCode;
  /** seconds to rest the key that caused this (rate_limited / auth) */
  retryAfter?: number;
  constructor(code: ErrorCode, message?: string, retryAfter?: number) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Shape the browser receives from every /api route on failure. */
export interface ApiFailure {
  error: { code: ErrorCode; message: string };
}
