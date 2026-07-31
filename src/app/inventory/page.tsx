import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryScreen } from "@/features/inventory/screens/inventory-screen";

export const metadata: Metadata = {
  title: "库存商品",
  description: "配件、翻新机、商品和库存流水",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-3 text-xs text-muted-foreground sm:p-6 sm:text-sm">正在加载库存...</div>
      }
    >
      <InventoryScreen />
    </Suspense>
  );
}
