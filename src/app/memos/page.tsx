import type { Metadata } from "next";
import { Suspense } from "react";

import { MemosScreen } from "@/features/memos/screens/memos-screen";

export const metadata: Metadata = {
  title: "备忘录 | RepairDesk",
  description: "记录本店铺交班事项并管理待办。",
};

export default function MemosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载备忘录...</div>}>
      <MemosScreen />
    </Suspense>
  );
}
