import type { Metadata } from "next";

import { InventoryLifecycleAfterSalesQueueScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "售后队列",
  description: "查看商品返修和保修案件队列",
};

export default function Page() {
  return <InventoryLifecycleAfterSalesQueueScreen />;
}
