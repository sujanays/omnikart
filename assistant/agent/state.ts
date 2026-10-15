import type { Lang } from "@/contract/lang";
import type { CartLine, Category, Order, Payment, StoreAdapter, StoreMeta } from "@/contract";
import { emptyFilters, type Filters } from "@/assistant/content/facets";
import type { Line } from "@/assistant/agent/templates";

export type Screen = "home" | "results" | "product" | "cart" | "checkout" | "ordered";

/** The six steps of the guided journey, for the step tracker. */
export type FlowStep = "ask" | "filters" | "matches" | "reviews" | "delivery" | "order";

export type { CartLine, Order };

/** Where the shopper is. Held in the browser; never sent to the LLM except as a short summary. */
export interface Ctx {
  screen: Screen;
  /** product ids on offer (1 to 3) */
  options: string[];
  productId: string | null;
  checkout: { payment: Payment; readbackDone: boolean } | null;
  lastOrderId: string | null;
  /** what the shopper is shopping for */
  category: Category | null;
  /** the filters chosen so far; the store's sidebar shows the same ones */
  filters: Filters;
  /** filter ids Omnikart still has to ask, in order */
  queue: string[];
  /** the filter whose answer Omnikart is waiting for */
  asking: string | null;
  step: FlowStep;
  /** Omnikart has introduced itself */
  introduced: boolean;
}

export function initialCtx(): Ctx {
  return {
    screen: "home",
    options: [],
    productId: null,
    checkout: null,
    lastOrderId: null,
    category: null,
    filters: emptyFilters(),
    queue: [],
    asking: null,
    step: "ask",
    introduced: false,
  };
}

/** Everything the executor needs. Plain data, so tests can build it by hand. */
export interface Snapshot {
  /** language we speak back */
  lang: Lang;
  /** language the shopper speaks */
  inputLang: Lang;
  cart: CartLine[];
  ctx: Ctx;
  orders: Order[];
  /** calm mode: one fact per card */
  calm: boolean;
  now: Date;
  /** what the shopper said (English if it was translated), for numbers like a chest size */
  userText: string;
  /** the store, reached only through the contract */
  store: StoreAdapter;
  /** what the store sells and how to ask about it, loaded once */
  meta: StoreMeta;
}

export interface Outcome {
  lines: Line[];
  ctx?: Partial<Ctx>;
  cart?: CartLine[];
  orders?: Order[];
  /** page to open */
  nav?: string;
  /** play the last answer again */
  repeat?: boolean;
  /** false: this is a message about the last answer (an error or a refusal), so "repeat" must not replay it */
  remember?: boolean;
  /** the executor needs the LLM to answer a question from a product's facts */
  ask?: { productId: string; question: string };
  /** decision log entries */
  log?: string[];
}

export function cartLinesCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}
