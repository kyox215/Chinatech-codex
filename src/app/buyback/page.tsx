import { Suspense } from "react";

import { BuybackScreen } from "@/features/buyback";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";
import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export const generateMetadata = createLocalizedMetadata("buyback.title");

export default async function Page() {
  const locale = await getServerLocale();

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          {translateMessage(locale, "page.loading")}
        </div>
      }
    >
      <BuybackScreen />
    </Suspense>
  );
}
