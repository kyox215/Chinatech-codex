import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { ProcurementCreate } from "@/components/procurement/procurement-create";

export const metadata: Metadata = { title: "新建工单采购" };
export default async function ProcurementNewPage({ searchParams }: { searchParams: Promise<{ repair?: string }> }) {
  const { repair } = await searchParams;
  return <BackendPageFrame plan={{ kind: "procurement-new",...(repair&&repair.length<=100?{id:repair}:{}) }}><ProcurementCreate key={repair??""} initialRepairId={repair} /></BackendPageFrame>;
}
