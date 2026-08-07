import type { Metadata } from "next";

import { InventoryLifecycleSaleScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "销售详情",
  description: "查看销售订单、取走和保修状态",
};

export default async function Page({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  return <InventoryLifecycleSaleScreen saleOrderId={saleId} />;
}
