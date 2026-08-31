import type { Metadata } from "next";
import { CustomerDetailScreen } from "@/features/customers/screens/customer-detail-screen";
import { getLocalizedMetadata } from "@/shared/i18n/metadata";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return getLocalizedMetadata("customers.detailTitle", { id });
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetailScreen id={id} />;
}
