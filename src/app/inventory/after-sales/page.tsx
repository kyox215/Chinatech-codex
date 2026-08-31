import { InventoryLifecycleAfterSalesQueueScreen } from "@/features/inventory/lifecycle";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.afterSalesTitle");

export default function Page() {
  return <InventoryLifecycleAfterSalesQueueScreen />;
}
