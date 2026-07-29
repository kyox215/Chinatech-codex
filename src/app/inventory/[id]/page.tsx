import type { Metadata } from "next";

import { InventoryProductDetailScreen } from "@/features/inventory/products";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `商品 ${id}`, description: "商品身份、库存状态和经营信息" };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <InventoryProductDetailScreen id={id} />;
}
