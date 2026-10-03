import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { CustomerList } from "@/components/customers/customer-list";
export const metadata: Metadata = { title: "客户管理" };
export default async function CustomerPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;
 return <BackendPage scope={`/app/customers` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><CustomerList /></BackendPage>; }
