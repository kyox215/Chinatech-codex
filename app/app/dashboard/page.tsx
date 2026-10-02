import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = { title: "工作台" };

export default function DashboardPage() {
  return <DashboardContent />;
}
