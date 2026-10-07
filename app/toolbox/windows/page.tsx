import type { Metadata } from "next";
import { WindowsToolsPage } from "@/components/toolbox/windows-tools-page";

export const metadata: Metadata = { title: "Windows 11 Pro 升级" };

export default function Page() {
  return <WindowsToolsPage />;
}
