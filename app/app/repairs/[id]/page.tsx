import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalIntakeDetail } from "@/components/repairs/local-intake-detail";
import { RepairDetail } from "@/components/repairs/repair-detail";
import { localIntakeId } from "@/lib/repair-intake-record";
import { getRepairOrder } from "@/lib/repair-fixtures";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { return { title: `工单 ${(await params).id}` }; }
export default async function RepairDetailPage({ params }: Props) {
  const { id } = await params;
  if (localIntakeId(id)) return <LocalIntakeDetail id={id} />;
  const order = getRepairOrder(id); if (!order) notFound();
  return <RepairDetail initialOrder={order} />;
}
