import type { Metadata } from "next";
import { SettingsScreen } from "@/features/settings/screens/settings-screen";

export const metadata: Metadata = {
  title: "设置",
  description: "门店、人员与系统设置",
};

export default function Page() {
  return <SettingsScreen />;
}
