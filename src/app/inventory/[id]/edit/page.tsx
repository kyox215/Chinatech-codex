import { InventoryProductEditScreen } from "@/features/inventory/products/screens/inventory-product-edit-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("inventory.editTitle");

export default async function InventoryProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryProductEditScreen id={id} />;
}
