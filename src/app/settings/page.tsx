import { Suspense } from "react";
import { SettingsScreen } from "@/features/settings/screens/settings-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";
import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export const generateMetadata = createLocalizedMetadata("settings.title");

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
      <SettingsScreen />
    </Suspense>
  );
}
