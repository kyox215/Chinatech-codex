import { ProfitCenterScreen } from "@/features/profit/screens/profit-center-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("profit.title");

export default function FinancePage() {
  return <ProfitCenterScreen />;
}
