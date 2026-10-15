import { cookies } from "next/headers";
import type { CartLine, Order } from "@/contract";
import type { StoreSession } from "@/store/service";

const NAME = "haat_session";

type State = { cart: CartLine[]; orders: Order[] };

function parse(raw: string | undefined): State {
  try {
    const j = raw ? (JSON.parse(raw) as Partial<State>) : {};
    const cart = Array.isArray(j.cart) ? j.cart.filter((l) => l && typeof l.id === "string" && Number.isInteger(l.qty) && l.qty > 0).slice(0, 30) : [];
    const orders = Array.isArray(j.orders) ? (j.orders as Order[]).slice(0, 5) : [];
    return { cart, orders };
  } catch {
    return { cart: [], orders: [] };
  }
}

/**
 * The shopper's cart and orders live in a cookie, so the store needs no database and the same cart is
 * seen by the store's pages and by the assistant, which both call the store's API with this cookie.
 */
export async function cookieSession(): Promise<StoreSession> {
  const jar = await cookies();
  let state = parse(jar.get(NAME)?.value);
  return {
    read: () => state,
    write: (s) => {
      state = s;
      jar.set(NAME, JSON.stringify(s), { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
    },
  };
}
