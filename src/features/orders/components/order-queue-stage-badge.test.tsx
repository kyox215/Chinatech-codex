import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderQueueStageBadge } from "./order-queue-stage-badge";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

afterEach(cleanup);

describe("OrderQueueStageBadge", () => {
  it("keeps the processing stage baseline in Chinese", () => {
    render(<OrderQueueStageBadge order={{ status: "repairing", workflow_status: "repair" }} />);

    expect(screen.getByText("正在处理")).toBeInTheDocument();
  });

  it.each([
    [{ status: "parts_ordered", workflow_status: "parts" }, "等待配件", "ordered"],
    [
      {
        status: "parts_arrived",
        workflow_status: "parts",
        parts_status: "arrived",
        notify_status: "not_sent",
      },
      "配件已到",
      "arrived",
    ],
    [
      {
        status: "parts_arrived",
        workflow_status: "parts",
        parts_status: "arrived",
        notify_status: "sent",
      },
      "已通知到货",
      "arrived_notified",
    ],
    [{ status: "repaired", workflow_status: "repair" }, "待通知取机", "repaired"],
    [
      { status: "repaired", workflow_status: "repair", notify_status: "sent" },
      "等待客户取机",
      "repaired_notified",
    ],
  ] as const)("renders %s as %s", (order, label, key) => {
    const { container } = render(<OrderQueueStageBadge order={order} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`[data-order-queue-stage="${key}"]`)).toBeInTheDocument();
  });

  it.each([
    ["it-IT", "In lavorazione"],
    ["en", "In progress"],
  ] as const)("localizes processing stage in %s", (locale, label) => {
    render(
      <LocaleProvider initialLocale={locale}>
        <OrderQueueStageBadge order={{ status: "repairing", workflow_status: "repair" }} />
      </LocaleProvider>,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("正在处理")).not.toBeInTheDocument();
  });

  it.each([
    ["completed", "完成"],
    ["cancelled", "作废"],
  ] as const)("marks terminal status %s as history-only", (status, label) => {
    render(<OrderQueueStageBadge order={{ status, workflow_status: "closed" }} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("marks exception-only cancellation as cancelled history", () => {
    const { container } = render(
      <OrderQueueStageBadge
        order={{ status: "repairing", workflow_status: "repair", exception_status: "cancelled" }}
      />,
    );

    expect(screen.getByText("作废")).toBeInTheDocument();
    expect(container.querySelector('[data-order-queue-stage="cancelled"]')).toBeInTheDocument();
  });
});
