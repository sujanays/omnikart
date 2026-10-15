import type { Metadata } from "next";
import { OrdersPage } from "@/store/components/OrdersPage";

export const metadata: Metadata = { title: "Your Orders" };

export default function Orders() {
  return <OrdersPage />;
}
