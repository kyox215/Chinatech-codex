import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderListSkeleton } from "@/features/orders/components/order-list-skeleton";
import { OrderListScreen } from "@/features/orders/screens/order-list-screen";

export const metadata: Metadata = {
  title: "工单",
  description: "查看与管理所有维修工单",
};

export default function Page() {
  return (
    <Suspense fallback={<OrderListSkeleton />}>
      <OrderListScreen />
    </Suspense>
  );
}
