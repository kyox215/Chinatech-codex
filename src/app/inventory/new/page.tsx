import { InventoryProductIntakeScreen } from "@/features/inventory/products";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.intakeTitle");

export default function Page() {
  return <InventoryProductIntakeScreen />;
}
