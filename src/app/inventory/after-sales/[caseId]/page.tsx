import { InventoryLifecycleAfterSalesCaseScreen } from "@/features/inventory/lifecycle";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.afterSalesDetailTitle");

export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <InventoryLifecycleAfterSalesCaseScreen caseId={caseId} />;
}
