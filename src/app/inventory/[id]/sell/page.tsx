import { InventoryLifecycleItemSaleScreen } from "@/features/inventory/lifecycle";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.saleTitle");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryLifecycleItemSaleScreen itemId={id} />;
}
