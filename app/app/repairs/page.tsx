import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { RepairList } from "@/components/repairs/repair-list";

export const metadata: Metadata = { title: "维修工单" };

export default function RepairsPage() {
  return <BackendPageFrame plan={{ kind: "repairs" }}><RepairList /></BackendPageFrame>;
}
