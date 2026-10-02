import type { Metadata } from "next";
import { RepairIntakeForm } from "@/components/repairs/repair-intake-form";

export const metadata: Metadata = { title: "新建维修工单" };

export default function NewRepairPage() {
  return <RepairIntakeForm />;
}
