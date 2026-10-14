import type { Metadata } from "next";
import { OfficeToolsPage } from "@/components/toolbox/office-tools-page";

export const metadata: Metadata = { title: "ChinaTech Office 助手" };

export default function Page() {
  return <OfficeToolsPage />;
}
