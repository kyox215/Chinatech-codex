import type { Metadata } from "next";
import { ToolboxPage } from "@/components/toolbox/toolbox-page";

export const metadata: Metadata = { title: "工具箱" };

export default function Page() {
  return <ToolboxPage />;
}
