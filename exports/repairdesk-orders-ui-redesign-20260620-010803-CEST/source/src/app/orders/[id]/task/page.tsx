import type { Metadata } from "next";

import { OrderTaskScreen } from "@/features/orders/screens/order-task-screen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `工单任务 ${id}`,
    description: "扫码查看当前维修任务、阶段进度和下一步操作",
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderTaskScreen id={id} />;
}
