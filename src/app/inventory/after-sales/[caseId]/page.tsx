import type { Metadata } from "next";

import { InventoryLifecycleAfterSalesCaseScreen } from "@/features/inventory/lifecycle";

export const metadata: Metadata = {
  title: "售后详情",
  description: "查看返修案件、检测和返还安排",
};

export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <InventoryLifecycleAfterSalesCaseScreen caseId={caseId} />;
}
