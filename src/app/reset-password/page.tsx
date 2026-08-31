import { ResetPasswordScreen } from "@/features/auth/screens/reset-password-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("auth.resetTitle");

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
