import type { Metadata } from "next";

import { InventoryLifecycleSaleScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "预订详情",
  description: "查看商品预订、定金和取走安排",
};

export default async function Page({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  return <InventoryLifecycleSaleScreen saleOrderId={reservationId} />;
}
