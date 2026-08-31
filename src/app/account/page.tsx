import { AccountCenterScreen } from "@/features/account/screens/account-center-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("account.title");

export default function AccountPage() {
  return <AccountCenterScreen />;
}
