import type { Metadata } from "next";
import { OrderDetailScreen } from "@/features/orders/screens/order-detail-screen";
import { getLocalizedMetadata } from "@/shared/i18n/metadata";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return getLocalizedMetadata("orders.detailTitle", { id });
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}
