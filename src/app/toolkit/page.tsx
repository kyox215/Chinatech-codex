import { notFound } from "next/navigation";

import { isRepairDeskToolkitEnabled } from "@/features/toolkit/model/toolkit-feature";
import { ToolkitScreen } from "@/features/toolkit/screens/toolkit-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("toolkit.title");

export default function ToolkitPage() {
  if (!isRepairDeskToolkitEnabled()) notFound();
  return <ToolkitScreen />;
}
