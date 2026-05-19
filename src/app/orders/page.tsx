import type { Metadata } from "next";
import { OrderListScreen } from "@/features/orders/screens/order-list-screen";

export const metadata: Metadata = {
  title: "工单",
  description: "查看与管理所有维修工单",
};

export default function Page() {
  return <OrderListScreen />;
}
