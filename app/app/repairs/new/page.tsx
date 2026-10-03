import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { RepairIntakeForm } from "@/components/repairs/repair-intake-form";

export const metadata: Metadata = { title: "新建维修工单" };

export default async function NewRepairPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;

  return <BackendPage scope={`/app/repairs/new` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><RepairIntakeForm /></BackendPage>;
}
