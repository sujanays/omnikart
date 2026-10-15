import { NextResponse } from "next/server";
import type { CartLine, Filters, Payment, SearchRequest, Sort } from "@/contract";
import { createStoreService } from "@/store/service";
import { cookieSession } from "@/store/session-cookie";
import { CATEGORIES } from "@/store/catalogue-types";

/**
 * The store's API: the contract in contract/index.ts, over HTTP.
 *   GET  /api/store/meta                    GET  /api/store/products/<id>      GET /api/store/reviews/<id>
 *   POST /api/store/search                  POST /api/store/products           (body: { ids })
 *   POST /api/store/compare                 GET  /api/store/cart               POST /api/store/cart   (body: { lines })
 *   POST /api/store/checkout                GET  /api/store/orders             GET /api/store/orders/<id>
 *   POST /api/store/orders/<id>/return
 */

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: { code: "bad_input", message } }, { status });
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function readFilters(x: unknown): Filters | null {
  if (!isObj(x) || !isObj(x.sel)) return null;
  const sel: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(x.sel)) {
    if (!/^[a-z_]{2,20}$/.test(k) || !Array.isArray(v) || !v.every((s) => typeof s === "string" && s.length < 40)) return null;
    sel[k] = v as string[];
  }
  const f: Filters = { sel };
  if (isObj(x.price)) {
    const { min, max } = x.price;
    f.price = { ...(typeof min === "number" ? { min } : {}), ...(typeof max === "number" ? { max } : {}) };
  }
  if (typeof x.rating === "number") f.rating = x.rating;
  return f;
}

async function handle(req: Request, params: Promise<{ op: string[] }>) {
  const { op } = await params;
  const store = createStoreService(await cookieSession());
  const [a, b, c] = op;
  const method = req.method;
  const body = method === "POST" ? await req.json().catch(() => null) : null;

  if (method === "GET" && a === "meta") return NextResponse.json(await store.meta());
  if (method === "GET" && a === "products" && b) {
    const p = await store.getProduct(b);
    return p ? NextResponse.json(p) : bad("unknown product", 404);
  }
  if (method === "POST" && a === "products") {
    const ids = isObj(body) && Array.isArray(body.ids) ? body.ids.filter((s): s is string => typeof s === "string").slice(0, 60) : [];
    return NextResponse.json(await store.getProducts(ids));
  }
  if (method === "GET" && a === "reviews" && b) return NextResponse.json(await store.getReviews(b));
  if (method === "POST" && a === "search") {
    if (!isObj(body) || typeof body.category !== "string" || !(CATEGORIES as readonly string[]).includes(body.category)) return bad("unknown category");
    const filters = readFilters(body.filters ?? { sel: {} });
    if (!filters) return bad("bad filters");
    const sort = body.sort === "price_low" || body.sort === "rating" || body.sort === "popular" ? (body.sort as Sort) : null;
    const reqBody: SearchRequest = { category: body.category, filters, sort, relax: body.relax === true };
    return NextResponse.json(await store.search(reqBody));
  }
  if (method === "POST" && a === "compare") {
    if (!isObj(body) || typeof body.a !== "string" || typeof body.b !== "string") return bad("need a and b");
    return NextResponse.json(await store.compare(body.a, body.b));
  }
  if (method === "GET" && a === "cart") return NextResponse.json(await store.getCart());
  if (method === "POST" && a === "cart") {
    const lines = isObj(body) && Array.isArray(body.lines) ? body.lines : null;
    if (!lines) return bad("need lines");
    const ok = lines.every((l): l is CartLine => isObj(l) && typeof l.id === "string" && typeof l.qty === "number" && l.qty >= 0 && l.qty < 100);
    if (!ok) return bad("bad lines");
    return NextResponse.json(await store.setCart(lines));
  }
  if (method === "POST" && a === "checkout") {
    if (!isObj(body)) return bad("need a body");
    const payment: Payment = body.payment === "online" ? "online" : "cod";
    const conf = isObj(body.confirmation) ? body.confirmation : null;
    const method2 = conf?.method === "button" || conf?.method === "voice" ? conf.method : null;
    const result = await store.checkout({ payment, confirmation: method2 ? { method: method2, phrase: typeof conf?.phrase === "string" ? conf.phrase.slice(0, 80) : undefined } : (undefined as never) });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }
  if (method === "GET" && a === "orders" && !b) return NextResponse.json(await store.getOrders());
  if (method === "GET" && a === "orders" && b) {
    const o = await store.track(b);
    return o ? NextResponse.json(o) : bad("unknown order", 404);
  }
  if (method === "POST" && a === "orders" && b && c === "return") {
    const o = await store.returnItem(b);
    return o ? NextResponse.json(o) : bad("unknown order", 404);
  }
  return bad("unknown operation", 404);
}

export async function GET(req: Request, ctx: { params: Promise<{ op: string[] }> }) {
  return handle(req, ctx.params);
}
export async function POST(req: Request, ctx: { params: Promise<{ op: string[] }> }) {
  return handle(req, ctx.params);
}
