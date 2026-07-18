import type { Metadata } from "next";

import { InventoryIntakeScreen } from "@/features/inventory/screens/inventory-intake-screen";

export const metadata: Metadata = {
  title: "库存入库",
  description: "分步录入库存商品、型号、唯一标识、来源、价格与质保",
};

export default function Page() {
  return <InventoryIntakeScreen />;
}
