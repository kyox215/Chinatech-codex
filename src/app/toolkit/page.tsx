import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRepairDeskToolkitEnabled } from "@/features/toolkit/model/toolkit-feature";
import { ToolkitScreen } from "@/features/toolkit/screens/toolkit-screen";

export const metadata: Metadata = {
  title: "工具集 | RepairDesk",
  description: "登录后访问 Chinatech 提供的软件与网页工具。",
};

export default function ToolkitPage() {
  if (!isRepairDeskToolkitEnabled()) notFound();
  return <ToolkitScreen />;
}
