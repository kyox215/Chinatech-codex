import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "设置 — RepairDesk" }] }),
  component: () => <ComingSoon title="门店设置" />,
});
