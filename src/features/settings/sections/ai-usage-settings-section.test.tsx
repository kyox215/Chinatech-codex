import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getMockAiAssistantUsageSummary } from "@/features/ai-assistant/testing/mock-usage";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { AiUsageSettingsSection } from "./ai-usage-settings-section";

afterEach(cleanup);

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

  it.each([
    ["zh-CN", "2026-03-29T00:30:00.000Z", "03/29 01:30", "AI 使用量"],
    ["zh-CN", "2026-03-29T01:30:00.000Z", "03/29 03:30", "AI 使用量"],
    ["it-IT", "2026-03-29T00:30:00.000Z", "29/03, 01:30", "Utilizzo AI"],
    ["it-IT", "2026-03-29T01:30:00.000Z", "29/03, 03:30", "Utilizzo AI"],
    ["en", "2026-03-29T00:30:00.000Z", "03/29, 01:30 AM", "AI usage"],
    ["en", "2026-03-29T01:30:00.000Z", "03/29, 03:30 AM", "AI usage"],
  ] as const)(
    "formats the Rome DST boundary in %s without depending on the host timezone",
    (locale, generatedAt, expectedTime, heading) => {
      const usage = getMockAiAssistantUsageSummary(new Date(generatedAt));
      render(
        <LocaleProvider initialLocale={locale}>
          <AiUsageSettingsSection
            usage={usage}
            isLoading={false}
            isError={false}
            onRetry={vi.fn()}
          />
        </LocaleProvider>,
      );

      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      expect(screen.getByText(new RegExp(expectedTime.replace(".", "\\.")))).toBeVisible();
      expect(usage.generated_at).toBe(generatedAt);
    },
  );

  it.each([
    ["zh-CN", "未知"],
    ["it-IT", "Sconosciuto"],
    ["en", "Unknown"],
  ] as const)("renders an invalid timestamp safely in %s", (locale, unknown) => {
    const usage = getMockAiAssistantUsageSummary();
    usage.generated_at = "RAW_INVALID_TIMESTAMP_SENTINEL";
    render(
      <LocaleProvider initialLocale={locale}>
        <AiUsageSettingsSection usage={usage} isLoading={false} isError={false} onRetry={vi.fn()} />
      </LocaleProvider>,
    );

    expect(screen.getByText(new RegExp(unknown))).toBeVisible();
    expect(screen.queryByText(/RAW_INVALID_TIMESTAMP_SENTINEL/)).not.toBeInTheDocument();
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
