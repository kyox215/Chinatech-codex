import type { Metadata } from "next";
import { InventoryScreen } from "@/features/inventory/screens/inventory-screen";

export const metadata: Metadata = {
  title: "库存",
  description: "配件库存与工单关联",
};

export default function Page() {
  return <InventoryScreen />;
}
