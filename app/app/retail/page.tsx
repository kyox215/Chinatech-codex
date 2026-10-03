import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RetailList } from "@/components/retail/retail-list";
import RetailLoading from "./loading";

export const metadata: Metadata = { title: "整机商品" };
export default async function RetailPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;
 return <BackendPage scope={`/app/retail` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><Suspense fallback={<RetailLoading />}><RetailList /></Suspense></BackendPage>; }
