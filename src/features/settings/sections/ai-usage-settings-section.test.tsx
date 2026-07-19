import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getMockAiAssistantUsageSummary } from "@/features/ai-assistant/testing/mock-usage";
import { AiUsageSettingsSection } from "./ai-usage-settings-section";

describe("AiUsageSettingsSection", () => {
  it("renders current-store request, token, cost and daily limit metrics", () => {
    render(
      <AiUsageSettingsSection
        usage={getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z"))}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "AI 使用量" })).toBeVisible();
    expect(screen.getByText("最近 30 天")).toBeVisible();
    expect(screen.getByText("83")).toBeVisible();
    expect(screen.getByText("72,480")).toBeVisible();
    expect(screen.getByText("$0.0264")).toBeVisible();
    expect(screen.getByText("6 / 50 次")).toBeVisible();
    expect(screen.getByText(/本地处理.*不会计入/)).toBeVisible();
  });

  it("shows explicit zero-usage and loading states", () => {
    const empty = getMockAiAssistantUsageSummary();
    empty.today = zeroMetric();
    empty.last_30_days = zeroMetric();
    empty.today_by_kind.order_text = { ...zeroMetric(), request_limit: null };
    empty.today_by_kind.inventory_vision = { ...zeroMetric(), request_limit: null };
    const view = render(
      <AiUsageSettingsSection usage={empty} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );

    expect(screen.getByText("最近 30 天尚无大模型用量")).toBeVisible();
    view.rerender(<AiUsageSettingsSection isLoading isError={false} onRetry={vi.fn()} />);
    expect(screen.getByLabelText("正在读取 AI 使用量")).toBeVisible();
  });

  it("keeps a failed usage read isolated and retryable", () => {
    const onRetry = vi.fn();
    render(<AiUsageSettingsSection isLoading={false} isError onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("AI 使用量读取失败");
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("separates an in-flight reservation from settled cost", () => {
    const usage = getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z"));
    usage.today.reserved_cost_microusd = 12_500;

    render(
      <AiUsageSettingsSection usage={usage} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("$0.0125 预留费用尚待结算");
    expect(screen.getAllByText("美元 · 已结算")).toHaveLength(2);
  });
});

function zeroMetric() {
  return {
    provider_request_count: 0,
    input_token_count: 0,
    cached_input_token_count: 0,
    output_token_count: 0,
    settled_cost_microusd: 0,
    reserved_cost_microusd: 0,
  };
}
