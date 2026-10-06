import type { Metadata } from "next";
import { Suspense } from "react";
import { RetailDetail } from "@/components/retail/retail-detail";
import RetailLoading from "../../loading";

export const metadata: Metadata = { title: "商品档案" };
export default async function RetailHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { id } = await params; const { returnTo } = await searchParams;
  return <Suspense fallback={<RetailLoading />}><RetailDetail id={id} returnTo={typeof returnTo === "string" ? returnTo : undefined} key={id} /></Suspense>;
}
