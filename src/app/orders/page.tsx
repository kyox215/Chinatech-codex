import type { Metadata } from "next";
import OrdersListPage from "@/routes/orders.index";

export const metadata: Metadata = {
  title: "工单",
  description: "查看与管理所有维修工单",
};

export default function Page() {
  return <OrdersListPage />;
}
