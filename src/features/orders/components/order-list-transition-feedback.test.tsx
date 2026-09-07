import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OrderBulkTransitionFeedback,
  OrderListTransitionFeedback,
} from "./order-list-transition-feedback";

afterEach(cleanup);

describe("OrderBulkTransitionFeedback", () => {
  const recovery = {
    scopeKey: "test",
    to: "diagnosing",
    successCount: 1,
    failures: [
      { id: "internal-secret-id", publicNo: "CT-2026-101", reason: "CONFLICT" },
      { id: "another-internal-id", publicNo: "another-internal-id", reason: "SECRET_SENTINEL" },
    ],
  };

  it("shows public order numbers and safe per-order failures without internal IDs", () => {
    const onRetry = vi.fn();
    render(<OrderBulkTransitionFeedback recovery={recovery} pending={false} onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("CT-2026-101");
    expect(alert).toHaveTextContent("工单已发生变化");
    expect(alert).toHaveTextContent("所选工单 2");
    expect(alert).not.toHaveTextContent(/internal|SECRET_SENTINEL/);
    fireEvent.click(screen.getByRole("button", { name: "重试失败工单" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the recovery visible while preventing duplicate retries", () => {
    const onRetry = vi.fn();
    render(<OrderBulkTransitionFeedback recovery={recovery} pending onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: "正在重试…" });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps whole-request uncertainty distinct from queue-load failures", () => {
    render(
      <OrderBulkTransitionFeedback
        recovery={{ ...recovery, requestFailed: true }}
        pending={false}
        retryDisabled
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("未能确认批量流转结果");
    expect(screen.getByRole("alert")).not.toHaveTextContent("已恢复上一次成功队列");
    expect(screen.getByRole("button", { name: "重试失败工单" })).toBeDisabled();
  });
});

describe("OrderListTransitionFeedback", () => {
  it("announces a blocking queue transition", () => {
    render(<OrderListTransitionFeedback pendingLabel="到货" onRetry={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在加载到货，当前列表暂不可操作");
  });

  it("announces failure and retries the failed intent", () => {
    const onRetry = vi.fn();
    render(
      <OrderListTransitionFeedback
        errorMessage="加载修好失败，已恢复上一次成功队列。"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("已恢复上一次成功队列");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("announces that cached orders remain visible while offline", () => {
    render(
      <OrderListTransitionFeedback
        offlineMessage="当前离线，显示最近数据。"
        pendingLabel="下单"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("当前离线，显示最近数据");
    expect(screen.queryByText(/正在加载下单/)).not.toBeInTheDocument();
  });
});
