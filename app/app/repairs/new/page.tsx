import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { RepairIntakeForm } from "@/components/repairs/repair-intake-form";

export const metadata: Metadata = { title: "新建维修工单" };

export default function NewRepairPage() {
  return <BackendPageFrame plan={{ kind: "repair-new" }}><RepairIntakeForm /></BackendPageFrame>;
}
