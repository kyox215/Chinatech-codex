import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/features/settings/screens/settings-screen";

export const metadata: Metadata = {
  title: "设置",
  description: "门店、人员与系统设置",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-3 text-xs text-muted-foreground sm:p-6 sm:text-sm">正在加载设置...</div>
      }
    >
      <SettingsScreen />
    </Suspense>
  );
}
