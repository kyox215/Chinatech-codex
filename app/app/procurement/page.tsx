import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { ProcurementList } from "@/components/procurement/procurement-list";

export const metadata: Metadata = { title: "采购与到货" };
export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ repair?: string }> }) {
  const { repair } = await searchParams;
  return <BackendPageFrame plan={{ kind: "procurement" }}><ProcurementList key={repair ?? "all"} initialRepairId={repair} /></BackendPageFrame>;
}
