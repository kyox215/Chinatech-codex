import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrderWorkflowProgress } from "./order-workflow-progress";
import { getOrderTaskGuidance } from "@/features/orders/model/order-task-flow";

afterEach(cleanup);

describe("OrderWorkflowProgress", () => {
  it("uses the cancellation stage instead of presenting collection as the current step", () => {
    const guidance = getOrderTaskGuidance({
      status: "repairing",
      workflow_status: "repair",
      exception_status: "cancelled",
      approval_overdue: false,
      pickup_overdue: false,
    });

    render(
      <OrderWorkflowProgress
        workflowStatus={guidance.workflowStatus}
        tone={guidance.tone}
        currentStage={guidance.stage}
        showLabels
      />,
    );

    expect(screen.getByLabelText("当前流程：取消归档")).toBeInTheDocument();
    expect(screen.getByText("取消归档")).toBeInTheDocument();
    expect(screen.getByText("消")).toBeInTheDocument();
    expect(screen.queryByText("收款完成")).not.toBeInTheDocument();
  });
});
