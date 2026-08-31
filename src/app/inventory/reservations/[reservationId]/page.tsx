import { InventoryLifecycleSaleScreen } from "@/features/inventory/lifecycle";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.reservationDetailTitle");

export default async function Page({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  return <InventoryLifecycleSaleScreen saleOrderId={reservationId} />;
}
