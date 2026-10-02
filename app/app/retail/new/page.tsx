import type { Metadata } from "next";
import { RetailForm } from "@/components/retail/retail-form";

export const metadata: Metadata = { title: "新建单机" };
export default async function RetailNewPage({ searchParams }: { searchParams: Promise<{ copy?: string | string[]; identifier?: string | string[]; kind?: string | string[] }> }) {
  const params = await searchParams;
  const copy = typeof params.copy === "string" ? params.copy : undefined;
  const identifier = typeof params.identifier === "string" ? params.identifier : undefined;
  const kind = typeof params.kind === "string" ? params.kind : undefined;
  return <RetailForm key={`${copy ?? "blank"}-${identifier ?? ""}-${kind ?? ""}`} copyId={copy} identifier={identifier} kind={kind} />;
}
