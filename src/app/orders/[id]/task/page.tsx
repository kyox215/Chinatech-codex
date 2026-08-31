import type { Metadata } from "next";

import { OrderTaskScreen } from "@/features/orders/screens/order-task-screen";
import { getLocalizedMetadata } from "@/shared/i18n/metadata";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return getLocalizedMetadata("orders.taskTitle", { id });
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderTaskScreen id={id} />;
}
