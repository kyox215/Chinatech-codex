import { Suspense } from "react";

import { ForgotPasswordScreen } from "@/features/auth/screens/forgot-password-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";
import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export const generateMetadata = createLocalizedMetadata("auth.forgotTitle");

export default async function ForgotPasswordPage() {
  const locale = await getServerLocale();

  return (
    <Suspense
      fallback={
        <div className="p-3 text-xs text-muted-foreground sm:p-6 sm:text-sm">
          {translateMessage(locale, "page.loading")}
        </div>
      }
    >
      <ForgotPasswordScreen />
    </Suspense>
  );
}
