import type {
  CartLine,
  CheckoutRequest,
  CheckoutResult,
  CompareDTO,
  Order,
  ProductDTO,
  ReviewDTO,
  SearchRequest,
  SearchResult,
  StoreAdapter,
  StoreMeta,
} from "@/contract";
import { UI_EVENT } from "@/contract";
import { ClientApiError } from "@/assistant/client/api";

/**
 * The assistant's only way to reach a store: the contract, over HTTP.
 *
 *   baseUrl   where the store lives. "" means the same site (the store's /api/store/* routes).
 *             A full address such as https://shop.example works too, with cookies, if the store allows it.
 *   guard     called before every request; the judge page's "cut the network" switch throws from here.
 *
 * Product data is kept for a short time so a turn that touches the same product three times asks once.
 * Prices therefore never get older than TTL_MS. Searches, carts and orders are never kept.
 */

const TTL_MS = 20_000;
const TIMEOUT_MS = 15_000;

export interface HttpAdapterOptions {
  baseUrl?: string;
  guard?: () => void;
  fetchImpl?: typeof fetch;
}

export class HttpStoreAdapter implements StoreAdapter {
  private base: string;
  private guard: () => void;
  private doFetch: typeof fetch;
  private metaPromise: Promise<StoreMeta> | null = null;
  private products = new Map<string, { dto: ProductDTO; at: number }>();

  constructor(opts: HttpAdapterOptions = {}) {
    this.base = (opts.baseUrl ?? "").replace(/\/$/, "");
    this.guard = opts.guard ?? (() => undefined);
    this.doFetch = opts.fetchImpl ?? ((...a) => fetch(...a));
  }

  private async call<T>(path: string, body?: unknown, allow409 = false): Promise<T> {
    this.guard();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.doFetch(`${this.base}/api/store/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: this.base ? "include" : "same-origin",
        cache: "no-store",
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new ClientApiError("timeout", 0);
      throw new ClientApiError("network", 0);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok && !(allow409 && res.status === 409)) throw new ClientApiError("bad_response", res.status, `store ${path}`);
    try {
      return (await res.json()) as T;
    } catch {
      throw new ClientApiError("bad_response", res.status, "Empty reply");
    }
  }

  /** Tell the page (and anyone else listening) that the cart or orders changed. */
  private changed(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UI_EVENT.cartChanged, { detail: {} }));
  }

  meta(): Promise<StoreMeta> {
    this.metaPromise ??= this.call<StoreMeta>("meta").catch((e) => {
      this.metaPromise = null;
      throw e;
    });
    return this.metaPromise;
  }

  search(req: SearchRequest): Promise<SearchResult> {
    return this.call<SearchResult>("search", req);
  }

  async getProduct(id: string): Promise<ProductDTO | null> {
    const hit = this.products.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.dto;
    try {
      const dto = await this.call<ProductDTO>(`products/${encodeURIComponent(id)}`);
      this.products.set(id, { dto, at: Date.now() });
      return dto;
    } catch (e) {
      if (e instanceof ClientApiError && e.status === 404) return null;
      throw e;
    }
  }

  async getProducts(ids: string[]): Promise<ProductDTO[]> {
    const now = Date.now();
    const missing = ids.filter((id) => {
      const hit = this.products.get(id);
      return !hit || now - hit.at >= TTL_MS;
    });
    if (missing.length) {
      const got = await this.call<ProductDTO[]>("products", { ids: missing });
      for (const dto of got) this.products.set(dto.id, { dto, at: now });
    }
    return ids.flatMap((id) => {
      const hit = this.products.get(id);
      return hit ? [hit.dto] : [];
    });
  }

  getReviews(id: string): Promise<ReviewDTO[]> {
    return this.call<ReviewDTO[]>(`reviews/${encodeURIComponent(id)}`);
  }

  compare(idA: string, idB: string): Promise<CompareDTO> {
    return this.call<CompareDTO>("compare", { a: idA, b: idB });
  }

  getCart(): Promise<CartLine[]> {
    return this.call<CartLine[]>("cart");
  }

  async setCart(lines: CartLine[]): Promise<CartLine[]> {
    const cart = await this.call<CartLine[]>("cart", { lines });
    this.changed();
    return cart;
  }

  async checkout(req: CheckoutRequest): Promise<CheckoutResult> {
    const res = await this.call<CheckoutResult>("checkout", req, true);
    this.products.clear();
    this.changed();
    return res;
  }

  getOrders(): Promise<Order[]> {
    return this.call<Order[]>("orders");
  }

  async track(orderId: string): Promise<Order | null> {
    try {
      return await this.call<Order>(`orders/${encodeURIComponent(orderId)}`);
    } catch (e) {
      if (e instanceof ClientApiError && e.status === 404) return null;
      throw e;
    }
  }

  async returnItem(orderId: string): Promise<Order | null> {
    try {
      const o = await this.call<Order>(`orders/${encodeURIComponent(orderId)}/return`, {});
      this.changed();
      return o;
    } catch (e) {
      if (e instanceof ClientApiError && e.status === 404) return null;
      throw e;
    }
  }
}
