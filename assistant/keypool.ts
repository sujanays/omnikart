import { ApiError } from "@/assistant/errors";
import { AUTH_REST_SECONDS, DEFAULT_REST_SECONDS, MAX_REST_SECONDS } from "@/assistant/config";

/**
 * Key pools. We hold several Groq keys and several AnuvaadHub token sets.
 * This is the only file that reads them from the environment.
 *
 *   take()   next key that is not resting (round robin)
 *   rest()   bench a key for a while after a 429 or a bad token
 *   status() healthy / resting counts, for /api/health
 *
 * A key value never leaves this file except to the code that calls the service.
 * Logs and the browser only ever see "key 4 of 10".
 */

export interface PoolEntry {
  /** 1 based number, safe to show in logs */
  n: number;
  /** pool size */
  total: number;
  url: string;
  token: string;
}

interface Slot {
  url: string;
  token: string;
  restUntil: number;
}

export interface PoolStatus {
  name: string;
  total: number;
  healthy: number;
  resting: number;
  issue?: string;
}

export function parseList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export class Pool {
  readonly name: string;
  private slots: Slot[];
  private cursor = 0;
  readonly issue?: string;

  constructor(name: string, tokens: string[], urls: string[] = []) {
    this.name = name;
    let issue: string | undefined;
    let u = urls;
    if (tokens.length > 0 && u.length === 0) {
      u = tokens.map(() => "");
    } else if (u.length === 1 && tokens.length > 1) {
      u = tokens.map(() => urls[0]);
    } else if (u.length !== tokens.length) {
      issue = `${name}: ${u.length} URLs but ${tokens.length} tokens, using the first ${Math.min(u.length, tokens.length)}`;
    }
    const count = Math.min(u.length, tokens.length);
    this.slots = Array.from({ length: count }, (_, i) => ({ url: u[i], token: tokens[i], restUntil: 0 }));
    this.issue = issue;
  }

  get size(): number {
    return this.slots.length;
  }

  /** Every key in the pool, resting or not. For scripts that test each key one by one. */
  all(): PoolEntry[] {
    return this.slots.map((s, i) => ({ n: i + 1, total: this.slots.length, url: s.url, token: s.token }));
  }

  take(now: number = Date.now()): PoolEntry | null {
    const total = this.slots.length;
    for (let i = 0; i < total; i++) {
      const idx = (this.cursor + i) % total;
      const s = this.slots[idx];
      if (s.restUntil <= now) {
        this.cursor = (idx + 1) % total;
        return { n: idx + 1, total, url: s.url, token: s.token };
      }
    }
    return null;
  }

  rest(n: number, seconds: number, now: number = Date.now()): void {
    const s = this.slots[n - 1];
    if (!s) return;
    const secs = Math.max(0, Math.min(seconds, MAX_REST_SECONDS * 10));
    s.restUntil = Math.max(s.restUntil, now + secs * 1000);
  }

  status(now: number = Date.now()): PoolStatus {
    const resting = this.slots.filter((s) => s.restUntil > now).length;
    return {
      name: this.name,
      total: this.slots.length,
      healthy: this.slots.length - resting,
      resting,
      issue: this.issue,
    };
  }
}

/** Build a pool from environment variables. `GROQ` reads GROQ_API_KEYS, others read NAME_URLS and NAME_TOKENS. */
export function buildPool(name: string, env: Record<string, string | undefined> = process.env): Pool {
  if (name === "GROQ") return new Pool(name, parseList(env.GROQ_API_KEYS));
  return new Pool(name, parseList(env[`${name}_TOKENS`]), parseList(env[`${name}_URLS`]));
}

const g = globalThis as unknown as { __omnikartPools?: Map<string, Pool> };

/** Pools survive hot reloads and are shared by every route in the same server instance. */
export function getPool(name: string): Pool {
  g.__omnikartPools ??= new Map();
  let p = g.__omnikartPools.get(name);
  if (!p) {
    p = buildPool(name);
    g.__omnikartPools.set(name, p);
  }
  return p;
}

export function resetPools(): void {
  g.__omnikartPools = new Map();
}

export interface PoolMeta {
  /** which key answered, "key 4 of 10" */
  key: number;
  keys: number;
  attempts: number;
  /** keys rested during this call */
  rested: number[];
  ms: number;
}

export interface PoolResult<T> {
  value: T;
  meta: PoolMeta;
}

/**
 * Call a service with a key from the pool.
 *   rate_limited   rest that key, try the next key at once
 *   auth           rest that key for ten minutes, try the next key
 *   timeout/network try the next key (this is the retry)
 *   anything else  stop and tell the caller
 */
export async function withPool<T>(
  poolName: string,
  call: (entry: PoolEntry) => Promise<T>,
  opts: { maxAttempts?: number; pool?: Pool } = {},
): Promise<PoolResult<T>> {
  const pool = opts.pool ?? getPool(poolName);
  if (pool.size === 0) {
    throw new ApiError("not_configured", `No keys or endpoints configured for ${poolName}`);
  }
  const maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? 4, pool.size));
  const rested: number[] = [];
  const started = Date.now();
  let last: ApiError | null = null;
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const entry = pool.take();
    if (!entry) break;
    attempts++;
    try {
      const value = await call(entry);
      return {
        value,
        meta: { key: entry.n, keys: entry.total, attempts, rested, ms: Date.now() - started },
      };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      last = err;
      if (err.code === "rate_limited") {
        pool.rest(entry.n, err.retryAfter ?? DEFAULT_REST_SECONDS);
        rested.push(entry.n);
      } else if (err.code === "auth") {
        pool.rest(entry.n, err.retryAfter ?? AUTH_REST_SECONDS);
        rested.push(entry.n);
      } else if (err.code === "timeout" || err.code === "network") {
        continue;
      } else {
        throw err;
      }
    }
  }
  throw last ?? new ApiError("rate_limited", `Every key in ${poolName} is resting`);
}
