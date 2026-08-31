import { ClosedStoresScreen } from "@/features/settings/screens/closed-stores-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("settings.closedStoresTitle");

export default function Page() {
  return <ClosedStoresScreen />;
}
