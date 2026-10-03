import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = { title: "工作台" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;

  return <BackendPage scope={`/app/dashboard` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><DashboardContent /></BackendPage>;
}
