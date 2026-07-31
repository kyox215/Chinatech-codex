import type { Metadata } from "next";
import { Suspense } from "react";

import { BuybackScreen } from "@/features/buyback";

export const metadata: Metadata = {
  title: "回收管理",
  description: "旧手机透明协商报价与客户口头答复记录工作台",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载回收...</div>}>
      <BuybackScreen />
    </Suspense>
  );
}
