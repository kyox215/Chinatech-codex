import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryScreen } from "@/features/inventory/screens/inventory-screen";

export const metadata: Metadata = {
  title: "回收库存",
  description: "手机回收、检测、上架和售卖闭环",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载库存...</div>}>
      <InventoryScreen />
    </Suspense>
  );
}
