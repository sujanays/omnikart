import type { StoreMeta } from "@/contract";
import { HttpStoreAdapter } from "@/assistant/adapter/http";

/**
 * The store, as seen from the assistant's own server routes. STORE_BASE_URL says where the store is;
 * without it the store is the same site the request came to (the demo setup, one app serving both).
 */
export function storeBase(req: Request): string {
  return (process.env.STORE_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

export function storeFor(req: Request): HttpStoreAdapter {
  return new HttpStoreAdapter({ baseUrl: storeBase(req) });
}

const metaCache = new Map<string, { at: number; meta: Promise<StoreMeta> }>();

/** meta() changes rarely, so it is kept for a few minutes. */
export function storeMeta(req: Request): Promise<StoreMeta> {
  const base = storeBase(req);
  const hit = metaCache.get(base);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.meta;
  const meta = storeFor(req)
    .meta()
    .catch((e) => {
      metaCache.delete(base);
      throw e;
    });
  metaCache.set(base, { at: Date.now(), meta });
  return meta;
}
