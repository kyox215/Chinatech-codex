import type { Metadata } from "next";
import SettingsPage from "@/routes/settings";

export const metadata: Metadata = {
  title: "设置",
  description: "门店、人员与系统设置",
};

export default function Page() {
  return <SettingsPage />;
}
