import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { ProcurementCreate } from "@/components/procurement/procurement-create";

export const metadata: Metadata = { title: "新建工单采购" };
export default async function ProcurementNewPage({ searchParams }: { searchParams: Promise<{ repair?: string }> }) {
  const { repair } = await searchParams;
  return <BackendPage scope={`/app/procurement/new`}><ProcurementCreate initialRepairId={repair} /></BackendPage>;
}
