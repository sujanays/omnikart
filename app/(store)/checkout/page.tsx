import type { Metadata } from "next";
import { CheckoutPage } from "@/store/components/CheckoutPage";

export const metadata: Metadata = { title: "Checkout" };

export default function Checkout() {
  return <CheckoutPage />;
}
