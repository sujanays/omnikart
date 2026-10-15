import { initialCtx, type Snapshot } from "@/assistant/agent/state";
import { createStoreService, memorySession, metaOf } from "@/store/service";

/** Tests talk to the store through the same contract, served in-process (no HTTP needed). */
export const NOW = new Date(2026, 9, 10, 12, 0, 0);
export const META = metaOf();

export function makeSnap(over: Partial<Snapshot> = {}, rand?: () => number): Snapshot {
  const session = memorySession();
  session.write({ cart: over.cart ?? [], orders: over.orders ?? [] });
  const store = createStoreService(session, { rand, now: () => NOW.getTime() });
  return { lang: "en", inputLang: "en", cart: [], ctx: initialCtx(), orders: [], calm: false, now: NOW, userText: "", store, meta: META, ...over };
}

/**
 * A stand-in for the network in route tests: the store's own API (/api/store/*) is answered by the
 * in-process service, everything else (Groq, AnuvaadHub) by `other`.
 */
export function storeFetch(other: (url: string, init?: RequestInit) => Promise<Response> | Response): typeof fetch {
  const store = createStoreService(memorySession());
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const m = url.match(/\/api\/store\/(.*)$/);
    if (!m) return other(url, init);
    const [a, b] = m[1].split("/");
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    if (a === "meta") return Response.json(await store.meta());
    if (a === "products" && b) {
      const p = await store.getProduct(decodeURIComponent(b));
      return p ? Response.json(p) : Response.json({ error: "none" }, { status: 404 });
    }
    if (a === "products") return Response.json(await store.getProducts(body.ids));
    return Response.json({ error: "not in test" }, { status: 404 });
  }) as typeof fetch;
}
