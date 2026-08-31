import { InventoryLifecycleSaleScreen } from "@/features/inventory/lifecycle";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.saleDetailTitle");

export default async function Page({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  return <InventoryLifecycleSaleScreen saleOrderId={saleId} />;
}
