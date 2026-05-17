import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "客户 — RepairDesk" }] }),
  component: () => <ComingSoon title="客户管理" />,
});
