import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryProductListScreen } from "@/features/inventory/products";

export const metadata: Metadata = {
  title: "商品库存",
  description: "查看与管理店内单件电子商品",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载库存...</div>}>
      <InventoryProductListScreen />
    </Suspense>
  );
}
