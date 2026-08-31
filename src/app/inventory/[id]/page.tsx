import type { Metadata } from "next";

import { InventoryProductDetailScreen } from "@/features/inventory/products";
import { getLocalizedMetadata } from "@/shared/i18n/metadata";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return getLocalizedMetadata("inventory.detailTitle", { id });
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <InventoryProductDetailScreen id={id} />;
}
