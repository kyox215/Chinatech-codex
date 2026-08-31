import { Suspense } from "react";

import { LoginScreen } from "@/features/auth/screens/login-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";
import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export const generateMetadata = createLocalizedMetadata("auth.login");

export default async function LoginPage() {
  const locale = await getServerLocale();

  return (
    <Suspense
      fallback={
        <div className="p-3 text-xs text-muted-foreground sm:p-6 sm:text-sm">
          {translateMessage(locale, "page.loading")}
        </div>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}
