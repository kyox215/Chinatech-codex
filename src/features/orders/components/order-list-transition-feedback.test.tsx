import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderListTransitionFeedback } from "./order-list-transition-feedback";

afterEach(cleanup);

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
