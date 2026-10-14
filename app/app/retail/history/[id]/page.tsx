import type { Metadata } from "next";
import { RetailDetail } from "@/components/retail/retail-detail";

export const metadata: Metadata = { title: "商品档案" };
export default async function RetailHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { id } = await params; const { returnTo } = await searchParams;
  return <RetailDetail id={id} returnTo={typeof returnTo === "string" ? returnTo : undefined} key={id} />;
}
