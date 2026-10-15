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
import { CONTRACT_VERSION } from "@/contract";
import { LANGS, type Lang } from "@/contract/lang";
import type { Product } from "@/store/catalogue-types";
import { CATEGORIES } from "@/store/catalogue-types";
import { FACETS, assignReasons, cartTotal, getProduct, matching, maxDeliveryDays, relaxFilters } from "@/store/catalogue";
import { CATEGORY_NAME } from "@/store/content/dictionary";
import { sellerIn } from "@/store/content/brands";
import { toFacetDef } from "@/store/content/facets";
import { mainDifference, reviewSummary, simpleFacts, specLabel, specValueText, topFacts } from "@/store/derive";
import { CATEGORY_WORDS, STORE_ADDRESS, STORE_NAME } from "@/store/identity";

/**
 * The store's side of the contract, in plain code. The HTTP routes in app/api/store call this, and so do
 * the store's own pages, so there is one source of truth for products, carts and orders.
 *
 * Cart and orders live in a "session" the caller supplies: a cookie in the real routes, a plain object in tests.
 */

export interface StoreSession {
  read(): { cart: CartLine[]; orders: Order[] };
  write(state: { cart: CartLine[]; orders: Order[] }): void;
}

export function memorySession(): StoreSession {
  let state: { cart: CartLine[]; orders: Order[] } = { cart: [], orders: [] };
  return { read: () => state, write: (s) => (state = s) };
}

const perLang = <T>(f: (lang: Lang) => T): Record<Lang, T> => Object.fromEntries(LANGS.map((l) => [l, f(l)])) as Record<Lang, T>;

export function toDTO(p: Product): ProductDTO {
  const s = reviewSummary(p, "en");
  return {
    id: p.id,
    category: p.category,
    brand: p.brand,
    name: p.name,
    price: p.price,
    mrp: p.mrp,
    rating: p.rating,
    ratingCount: p.ratingCount,
    stock: p.stock,
    deliveryDays: p.deliveryDays,
    seller: perLang((l) => sellerIn(p.seller, l)),
    returnDays: p.returnDays,
    bestSeller: p.bestSeller,
    choice: p.choice,
    touchFriendly: p.touchFriendly,
    hero: p.hero,
    url: `/product/${p.id}`,
    domId: `product-${p.id}`,
    photo: p.photo,
    look: p.look,
    sizes: Array.isArray(p.attrs.sizes) ? (p.attrs.sizes as number[]) : undefined,
    specs: p.specs.map((sp) => ({ key: sp.key, label: perLang((l) => specLabel(sp, l)), value: perLang((l) => specValueText(sp, l)) })),
    topFacts: perLang((l) => topFacts(p, l)),
    simpleFacts: perLang((l) => simpleFacts(p, l)),
    access: p.access.map((a) => ({ by: a.by, text: a.text })),
    reviewSummary: {
      count: s.reviewCount,
      average: s.average,
      verdict: s.verdict,
      pros: perLang((l) => reviewSummary(p, l).pros),
      cons: perLang((l) => reviewSummary(p, l).cons),
    },
  };
}

export function metaOf(): StoreMeta {
  return {
    contractVersion: CONTRACT_VERSION,
    name: STORE_NAME,
    address: STORE_ADDRESS,
    categories: CATEGORIES.map((c) => ({
      id: c,
      name: CATEGORY_NAME[c],
      words: CATEGORY_WORDS[c],
      url: `/s?c=${c}`,
      facets: FACETS[c].map(toFacetDef),
    })),
    urls: { home: "/", cart: "/cart", checkout: "/checkout", orders: "/orders", product: "/product/{id}" },
    elements: { addToCart: "add-to-cart", goCheckout: "go-checkout", placeOrder: "place-order" },
    payments: ["cod", "online"],
  };
}

export function newOrderId(rand: () => number = Math.random): string {
  return String(10000 + Math.floor(rand() * 90000));
}

export function createStoreService(session: StoreSession, opts: { rand?: () => number; now?: () => number } = {}): StoreAdapter {
  const now = opts.now ?? (() => Date.now());
  const clean = (lines: CartLine[]): CartLine[] => {
    const merged = new Map<string, number>();
    for (const l of lines) merged.set(l.id, (merged.get(l.id) ?? 0) + Math.floor(l.qty));
    const out: CartLine[] = [];
    for (const [id, qty] of merged) {
      const p = getProduct(id);
      const q = p ? Math.min(qty, p.stock) : 0;
      if (q > 0) out.push({ id, qty: q });
    }
    return out;
  };

  return {
    async meta() {
      return metaOf();
    },

    async search(req: SearchRequest): Promise<SearchResult> {
      const sort = req.sort ?? null;
      let filters = req.filters;
      let dropped: string[] = [];
      let items = matching(req.category, filters, sort);
      if (items.length === 0 && req.relax) {
        const r = relaxFilters(req.category, filters);
        filters = r.filters;
        dropped = r.dropped;
        items = matching(req.category, filters, sort);
      }
      return {
        items: items.map(toDTO),
        total: FACETS[req.category] ? matching(req.category, { sel: {} }).length : 0,
        reasons: assignReasons(items.slice(0, 3)),
        filters,
        dropped,
      };
    },

    async getProduct(id) {
      const p = getProduct(id);
      return p ? toDTO(p) : null;
    },

    async getProducts(ids) {
      return ids.map((id) => getProduct(id)).filter((p): p is Product => !!p).map(toDTO);
    },

    async getReviews(id): Promise<ReviewDTO[]> {
      const p = getProduct(id);
      return p ? p.reviews.map((r) => ({ id: r.id, stars: r.stars, lang: r.lang, text: r.text })) : [];
    },

    async compare(a, b): Promise<CompareDTO> {
      const pa = getProduct(a);
      const pb = getProduct(b);
      const d = pa && pb ? mainDifference(pa, pb) : null;
      if (!d) return { difference: null };
      return {
        difference: {
          label: perLang((l) => specLabel(d.a, l)),
          a: perLang((l) => specValueText(d.a, l)),
          b: perLang((l) => specValueText(d.b, l)),
        },
      };
    },

    async getCart() {
      return session.read().cart;
    },

    async setCart(lines) {
      const cart = clean(lines);
      session.write({ ...session.read(), cart });
      return cart;
    },

    async checkout(req: CheckoutRequest): Promise<CheckoutResult> {
      const { cart, orders } = session.read();
      if (!req.confirmation || (req.confirmation.method !== "button" && req.confirmation.method !== "voice")) return { ok: false, reason: "no_confirmation" };
      if (cart.length === 0) return { ok: false, reason: "empty_cart" };
      if (cart.some((l) => l.qty > (getProduct(l.id)?.stock ?? 0))) return { ok: false, reason: "out_of_stock" };
      const order: Order = {
        id: newOrderId(opts.rand),
        lines: cart.map((l) => ({ ...l })),
        total: cartTotal(cart),
        payment: req.payment,
        placedAt: now(),
        deliveryDays: maxDeliveryDays(cart),
        status: "packed",
      };
      session.write({ cart: [], orders: [order, ...orders].slice(0, 5) });
      return { ok: true, order };
    },

    async getOrders() {
      return session.read().orders;
    },

    async track(orderId) {
      return session.read().orders.find((o) => o.id === orderId) ?? null;
    },

    async returnItem(orderId) {
      const { cart, orders } = session.read();
      const o = orders.find((x) => x.id === orderId);
      if (!o) return null;
      const updated: Order = { ...o, status: "return" };
      session.write({ cart, orders: orders.map((x) => (x.id === orderId ? updated : x)) });
      return updated;
    },
  };
}
