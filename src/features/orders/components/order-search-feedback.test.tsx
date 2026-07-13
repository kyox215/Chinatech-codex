import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createOrderResultGroupCounts } from "@/features/orders/model/order-list-grouping";
import { OrderSearchFeedback } from "./order-search-feedback";

const baseProps = {
  draftValue: "Xiaomi",
  committedValue: "Xiaomi",
  isDebouncing: false,
  isFetching: false,
  isPlaceholderData: false,
  hasError: false,
  total: 9,
  resultGroupCounts: {
    ...createOrderResultGroupCounts(),
    processing: 6,
    completed: 2,
    cancelled: 1,
  },
  canSearchArchive: true,
  onRetry: vi.fn(),
};

describe("OrderSearchFeedback", () => {
  it("announces debounce and retained-result loading states", () => {
    const { rerender } = render(
      <OrderSearchFeedback {...baseProps} draftValue="Xiaomi 14" isDebouncing />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("准备搜索“Xiaomi 14”");

    rerender(<OrderSearchFeedback {...baseProps} isFetching isPlaceholderData />);
    expect(screen.getByRole("status")).toHaveTextContent("正在搜索“Xiaomi”");
    expect(screen.getByRole("status")).toHaveTextContent("上次结果暂时保留");
  });

  it("summarizes active and historical search results", () => {
    render(<OrderSearchFeedback {...baseProps} />);

    expect(screen.getByRole("status")).toHaveTextContent("“Xiaomi”找到 9 条 · 待办 6 · 历史 3");
  });

  it("keeps visible progress feedback while clearing a retained result set", () => {
    render(
      <OrderSearchFeedback
        {...baseProps}
        draftValue=""
        committedValue=""
        isFetching
        isPlaceholderData
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在更新订单");
    expect(screen.getByRole("status")).toHaveTextContent("上次结果暂时保留");
  });

  it("keeps the retry action visible when refreshing fails", () => {
    const onRetry = vi.fn();
    render(<OrderSearchFeedback {...baseProps} hasError onRetry={onRetry} />);

    screen.getByRole("button", { name: "重试" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("仍显示上次结果");
  });
});
