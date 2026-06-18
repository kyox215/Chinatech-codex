import type { Metadata } from "next";
import { CustomerDetailScreen } from "@/features/customers/screens/customer-detail-screen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `客户 ${id}`,
    description: "客户资料、设备、历史工单与客户待办",
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetailScreen id={id} />;
}
