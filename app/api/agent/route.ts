import { pickAction } from "@/assistant/groq";
import { storeFor, storeMeta } from "@/assistant/server/store";
import { fail, faultsOf, metaForClient, readJson, readText } from "@/assistant/server/http";

export const maxDuration = 30;

const SCREENS = new Set(["home", "results", "product", "cart", "checkout", "ordered"]);

/**
 * POST { text, state: { screen, options: string[], productId, cartCount, category, asking } }
 * `text` is English when translation worked, otherwise the shopper's own words.
 * Returns { action, source, model?, reason?, meta }. The LLM only picks an action.
 * Product names are looked up here from ids, so the browser cannot smuggle text into the prompt.
 */
export async function POST(req: Request) {
  try {
    const faults = faultsOf(req);
    const body = await readJson(req);
    const text = readText(body.text, "text", 400);
    const st = (body.state ?? {}) as Record<string, unknown>;
    const screen = typeof st.screen === "string" && SCREENS.has(st.screen) ? st.screen : "home";
    const meta = await storeMeta(req);
    const store = storeFor(req);
    const ids = Array.isArray(st.options) ? st.options.filter((x): x is string => typeof x === "string").slice(0, 3) : [];
    const options = await store.getProducts(ids);
    const viewing = typeof st.productId === "string" ? ((await store.getProduct(st.productId)) ?? undefined) : undefined;
    const cartCount = typeof st.cartCount === "number" && Number.isFinite(st.cartCount) ? Math.max(0, Math.min(99, Math.floor(st.cartCount))) : 0;

    const category = typeof st.category === "string" && meta.categories.some((c) => c.id === st.category) ? st.category : "none";
    const asking = typeof st.asking === "string" && /^[a-z_]{2,20}$/.test(st.asking) ? st.asking : "none";

    const summary =
      `STATE: screen=${screen}; category=${category}; asking=${asking}; ` +
      `options=[${options.map((p, i) => `${i + 1} ${p.name.en}`).join(", ")}]; ` +
      `viewing=${viewing ? viewing.name.en : "none"}; cart_items=${cartCount}`;

    const r = await pickAction(summary, text, { hasProduct: !!viewing, optionCount: options.length }, meta.categories, { fault429: faults.has("groq_429") });
    return Response.json({
      action: r.action,
      source: r.source,
      model: r.model,
      reason: r.reason,
      meta: metaForClient(r.meta),
    });
  } catch (e) {
    return fail(e);
  }
}
