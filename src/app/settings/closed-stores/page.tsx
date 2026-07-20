import type { Metadata } from "next";

import { ClosedStoresScreen } from "@/features/settings/screens/closed-stores-screen";

export const metadata: Metadata = {
  title: "已关闭与删除",
  description: "查看和恢复已关闭的店铺",
};

export default function Page() {
  return <ClosedStoresScreen />;
}
