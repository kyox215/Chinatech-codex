import type { Metadata } from "next";
import { ProcurementDetail } from "@/components/procurement/procurement-detail";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `采购 ${id}` };
}
export default async function ProcurementDetailPage({ params }: Props) {
  const { id } = await params;
  return <ProcurementDetail key={id} id={id} />;
}
