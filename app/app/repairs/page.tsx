import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { RepairList } from "@/components/repairs/repair-list";

export const metadata: Metadata = { title: "维修工单" };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;

  return <BackendPage scope={`/app/repairs` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><RepairList /></BackendPage>;
}
