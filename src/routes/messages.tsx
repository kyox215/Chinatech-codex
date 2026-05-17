import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "消息模板 — RepairDesk" }] }),
  component: () => <ComingSoon title="消息模板" />,
});
