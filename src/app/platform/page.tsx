import type { Metadata } from "next";

import { PlatformAdminScreen } from "@/features/platform/screens/platform-admin-screen";

export const metadata: Metadata = {
  title: "平台审批",
  description: "RepairDesk 平台账号与店铺申请审批",
};

export default function PlatformPage() {
  return <PlatformAdminScreen />;
}
