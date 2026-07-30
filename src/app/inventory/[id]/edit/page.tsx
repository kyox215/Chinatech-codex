import type { Metadata } from "next";

import { InventoryProductEditScreen } from "@/features/inventory/products/screens/inventory-product-edit-screen";

export const metadata: Metadata = { title: "编辑商品 — RepairDesk" };

export default async function InventoryProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryProductEditScreen id={id} />;
}
