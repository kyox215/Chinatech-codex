import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

import { pageShell, stateBlocks } from "@/lib/ui-patterns";

export const metadata: Metadata = {
  title: "离线",
  description: "RepairDesk 离线状态提示",
};

export default function OfflinePage() {
  return (
    <div className={pageShell.detail}>
      <section className="glass-card mx-auto mt-16 max-w-md p-6 text-center">
        <div
          className={stateBlocks.emptyIcon}
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden="true"
        >
          <WifiOff className="size-5" />
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">当前离线</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          网络恢复后可继续打开工单、客户和库存页面。已经打开过的离线提示会保留在设备中。
        </p>
      </section>
    </div>
  );
}
