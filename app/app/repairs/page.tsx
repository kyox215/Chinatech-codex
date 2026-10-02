import type { Metadata } from "next";
import { RepairList } from "@/components/repairs/repair-list";

export const metadata: Metadata = { title: "维修工单" };

export default function RepairsPage() {
  return <RepairList />;
}
