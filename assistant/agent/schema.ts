/**
 * The only things the LLM may ask for. It picks ONE typed action; plain code does the rest.
 * The LLM never writes a price, a rating, a date or a total: those come from the catalogue.
 */

import type { Category, Payment, Sort } from "@/contract";

export type { Category, Payment, Sort };

/** A category is whatever the store's meta() says it sells; here it is just a short word. */
export const SORTS = ["price_low", "rating", "popular"] as const;
export const PAYMENTS = ["cod", "online"] as const;

export const ACTIONS = [
  "search",
  "set_filter",
  "skip_filter",
  "change_filters",
  "show_matches",
  "delivery_info",
  "open",
  "top_facts",
  "compare",
  "add_to_cart",
  "remove_from_cart",
  "read_cart",
  "checkout",
  "track_order",
  "return_order",
  "reviews",
  "describe_photo",
  "size_help",
  "explain_simpler",
  "ask_product",
  "repeat",
  "go_back",
  "where_am_i",
  "help",
  "clarify",
  "out_of_scope",
] as const;
export type ActionName = (typeof ACTIONS)[number];

export type Pick3 = 1 | 2 | 3;

export interface Action {
  action: ActionName;
  category: Category | null;
  max_price: number | null;
  min_rating: number | null;
  keywords: string | null;
  sort: Sort | null;
  pick: Pick3 | null;
  pick2: Pick3 | null;
  quantity: number | null;
  payment: Payment | null;
  question: string | null;
  clarify: string | null;
  /** which filter the shopper is talking about, e.g. "brand" (set_filter) */
  facet: string | null;
  /** what they chose for it, in their words, e.g. "Samsung" (set_filter) */
  value: string | null;
}

export function emptyAction(action: ActionName): Action {
  return {
    action,
    category: null,
    max_price: null,
    min_rating: null,
    keywords: null,
    sort: null,
    pick: null,
    pick2: null,
    quantity: null,
    payment: null,
    question: null,
    clarify: null,
    facet: null,
    value: null,
  };
}

/** JSON Schema for Groq structured outputs, strict mode: every field required, nullable when unused. */
export const ACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "action",
    "category",
    "max_price",
    "min_rating",
    "keywords",
    "sort",
    "pick",
    "pick2",
    "quantity",
    "payment",
    "question",
    "clarify",
    "facet",
    "value",
  ],
  properties: {
    action: { type: "string", enum: [...ACTIONS] },
    category: { type: ["string", "null"] },
    max_price: { type: ["number", "null"] },
    min_rating: { type: ["number", "null"] },
    keywords: { type: ["string", "null"] },
    sort: { type: ["string", "null"], enum: [...SORTS, null] },
    pick: { type: ["integer", "null"] },
    pick2: { type: ["integer", "null"] },
    quantity: { type: ["integer", "null"] },
    payment: { type: ["string", "null"], enum: [...PAYMENTS, null] },
    question: { type: ["string", "null"] },
    clarify: { type: ["string", "null"] },
    facet: { type: ["string", "null"] },
    value: { type: ["string", "null"] },
  },
} as const;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}
function num(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
}
function int(v: unknown, min: number, max: number): number | null {
  const n = num(v, min, max);
  return n !== null && Number.isInteger(n) ? n : null;
}
function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Never trust the model. Returns a clean Action, or null if `action` is not one we know.
 * Out of range numbers, unknown enum values and over long strings become null.
 */
export function validateAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const action = oneOf(r.action, ACTIONS);
  if (!action) return null;
  return {
    action,
    category: ((c) => (c && /^[a-z_]{2,20}$/.test(c) ? c : null))(str(r.category, 20)),
    max_price: num(r.max_price, 1, 10_000_000),
    min_rating: num(r.min_rating, 0, 5),
    keywords: str(r.keywords, 60),
    sort: oneOf(r.sort, SORTS),
    pick: int(r.pick, 1, 3) as Pick3 | null,
    pick2: int(r.pick2, 1, 3) as Pick3 | null,
    quantity: int(r.quantity, 1, 20),
    payment: oneOf(r.payment, PAYMENTS),
    question: str(r.question, 200),
    clarify: str(r.clarify, 160),
    facet: ((f) => (f && /^[a-z_]{2,20}$/.test(f) ? f : null))(str(r.facet, 20)),
    value: str(r.value, 60),
  };
}
