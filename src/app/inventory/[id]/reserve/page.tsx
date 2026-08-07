import type { Metadata } from "next";

import { InventoryLifecycleReservationScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "新建商品预订",
  description: "为在售商品登记客户、定金和预计取走时间",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryLifecycleReservationScreen itemId={id} />;
}
