import type { Metadata } from "next";
import { CartPage } from "@/store/components/CartPage";

export const metadata: Metadata = { title: "Shopping Cart" };

export default function Cart() {
  return <CartPage />;
}
