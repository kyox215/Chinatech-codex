import type { Metadata } from "next";
import NewOrderPage from "@/routes/orders.new";

export const metadata: Metadata = {
  title: "新建工单",
  description: "录入新工单：客户、设备、故障与报价",
};

export default function Page() {
  return <NewOrderPage />;
}
