import { DashboardScreen } from "@/features/dashboard/screens/dashboard-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("nav.dashboard.title");

export default function Page() {
  return <DashboardScreen />;
}
