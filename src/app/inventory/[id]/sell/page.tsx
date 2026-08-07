import type { Metadata } from "next";

import { InventoryLifecycleItemSaleScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "商品成交",
  description: "查看成交、付款、取走和保修工作流",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryLifecycleItemSaleScreen itemId={id} />;
}
