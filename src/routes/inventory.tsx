import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "库存 — RepairDesk" }] }),
  component: () => <ComingSoon title="库存管理" />,
});
