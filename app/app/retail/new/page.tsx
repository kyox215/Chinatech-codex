import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { RetailForm } from "@/components/retail/retail-form";

export const metadata: Metadata = { title: "新建单机" };
export default async function RetailNewPage({ searchParams }: { searchParams: Promise<{ copy?: string | string[]; identifier?: string | string[]; kind?: string | string[] }> }) {
  const params = await searchParams;
  const copy = typeof params.copy === "string" ? params.copy : undefined;
  const identifier = typeof params.identifier === "string" ? params.identifier : undefined;
  const kind = typeof params.kind === "string" ? params.kind : undefined;
  return <BackendPage scope={`/app/retail/new` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(params))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><RetailForm key={`${copy ?? "blank"}-${identifier ?? ""}-${kind ?? ""}`} copyId={copy} identifier={identifier} kind={kind} /></BackendPage>;
}
