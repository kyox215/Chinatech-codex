import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "工单 — RepairDesk" },
      { name: "description", content: "查看、筛选与管理所有维修工单" },
    ],
  }),
  component: () => <Outlet />,
});
