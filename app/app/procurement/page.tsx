import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { ProcurementList } from "@/components/procurement/procurement-list";

export const metadata: Metadata = { title: "采购与到货" };
export default async function ProcurementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const repair = typeof values.repair === "string" ? values.repair : undefined;
  const query = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return <BackendPage scope={`/app/procurement${query.size ? `?${query}` : ""}`}><ProcurementList key={repair ?? "all"} initialRepairId={repair} /></BackendPage>;
}
