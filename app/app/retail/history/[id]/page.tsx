import type { Metadata } from "next";
import { Suspense } from "react";
import { RetailHistoryDetail } from "@/components/retail/retail-history-detail";
import RetailLoading from "../../loading";

export const metadata: Metadata = { title: "历史整机" };
export default async function RetailHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<RetailLoading />}><RetailHistoryDetail id={id} key={id} /></Suspense>;
}
