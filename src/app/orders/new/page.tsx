import type { Metadata } from "next";
import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";
import { parseNewOrderPrefill } from "@/features/orders/model/new-order-intent";

export const metadata: Metadata = {
  title: "新建工单",
  description: "录入新工单：客户、设备、故障与报价",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = parseNewOrderPrefill(await searchParams);
  return <NewOrderScreen key={prefill.key} prefill={prefill} />;
}
