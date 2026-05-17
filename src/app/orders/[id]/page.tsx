import type { Metadata } from "next";
import OrderDetailPage from "@/routes/orders.$id";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `工单 ${id}`,
    description: "工单详情、报价、时间线与通知",
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailPage id={id} />;
}
