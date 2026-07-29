import type { Metadata } from "next";

import { InventoryProductIntakeScreen } from "@/features/inventory/products";

export const metadata: Metadata = {
  title: "快速录入商品",
  description: "单页录入手机、平板、电脑、游戏机和其他单件商品",
};

export default function Page() {
  return <InventoryProductIntakeScreen />;
}
