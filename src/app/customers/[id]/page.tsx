import type { Metadata } from "next";
import CustomerDetailPage from "@/routes/customers.$id";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `客户 ${id}`,
    description: "客户资料、设备、历史工单与回访",
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetailPage id={id} />;
}
