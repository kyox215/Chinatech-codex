import { Suspense } from "react";
import { InventoryProductListScreen } from "@/features/inventory/products";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";
import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export const generateMetadata = createLocalizedMetadata("inventory.title");

export default async function Page() {
  const locale = await getServerLocale();

  return (
    <Suspense
      fallback={
        <div className="p-3 text-xs text-muted-foreground sm:p-6 sm:text-sm">
          {translateMessage(locale, "page.loading")}
        </div>
      }
    >
      <InventoryProductListScreen />
    </Suspense>
  );
}
