import type { Metadata } from "next";
import { CustomerListScreen } from "@/features/customers/screens/customer-list-screen";

export const metadata: Metadata = {
  title: "客户",
  description: "客户资料、设备与历史工单",
};

export default function Page() {
  return <CustomerListScreen />;
}
