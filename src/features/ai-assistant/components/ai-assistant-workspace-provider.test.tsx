import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canReadAggregateFinance: false,
  getAiAssistantCapabilities: vi.fn(),
  getAiAssistantUsageSummary: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getAiAssistantCapabilities: mocks.getAiAssistantCapabilities,
  getAiAssistantUsageSummary: mocks.getAiAssistantUsageSummary,
}));

vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({
    activeStore: { id: "store-1" },
    authorityFingerprint: `user-1|store-1|${mocks.canReadAggregateFinance ? "usage" : "no-usage"}`,
    permissions: { canReadAggregateFinance: mocks.canReadAggregateFinance },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/features/ai-assistant/components/ai-assistant-sheet", () => ({
  AiAssistantSheet: ({
    open,
    usage,
    onModelUsageChanged,
  }: {
    open: boolean;
    usage?: { today_by_kind: { order_text: { provider_request_count: number } } };
    onModelUsageChanged: () => void;
  }) => (
    <div data-testid="assistant-sheet" data-open={open ? "true" : "false"}>
      {usage ? <span>今日请求 {usage.today_by_kind.order_text.provider_request_count}</span> : null}
      {open ? (
        <button type="button" onClick={onModelUsageChanged}>
          模拟模型查询成功
        </button>
      ) : null}
    </div>
  ),
}));

import { getMockAiAssistantUsageSummary } from "@/features/ai-assistant/testing/mock-usage";
import {
  AiAssistantWorkspaceProvider,
  useAiAssistantWorkspace,
} from "./ai-assistant-workspace-provider";

describe("AiAssistantWorkspaceProvider usage scope", () => {
  beforeEach(() => {
    mocks.canReadAggregateFinance = false;
    mocks.getAiAssistantCapabilities.mockReset();
    mocks.getAiAssistantUsageSummary.mockReset();
    mocks.getAiAssistantCapabilities.mockResolvedValue({
      canUseOrderAssistant: true,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
    });
    mocks.getAiAssistantUsageSummary.mockResolvedValue(
      getMockAiAssistantUsageSummary(new Date("2026-07-19T10:00:00.000Z")),
    );
  });

  it("does not request aggregate usage for an unauthorized member", async () => {
    renderProvider(<OpenAssistantButton />);

    const openButton = screen.getByRole("button", { name: "打开 AI" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);
    await waitFor(() =>
      expect(screen.getByTestId("assistant-sheet")).toHaveAttribute("data-open", "true"),
    );

    expect(mocks.getAiAssistantUsageSummary).not.toHaveBeenCalled();
  });

  it("loads usage only after opening and refreshes the shared store cache after model success", async () => {
    mocks.canReadAggregateFinance = true;
    renderProvider(<OpenAssistantButton />);

    const openButton = screen.getByRole("button", { name: "打开 AI" });
    await waitFor(() => expect(openButton).toBeEnabled());
    expect(mocks.getAiAssistantUsageSummary).not.toHaveBeenCalled();

    fireEvent.click(openButton);
    expect(await screen.findByText("今日请求 6")).toBeVisible();
    expect(mocks.getAiAssistantUsageSummary).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "模拟模型查询成功" }));
    await waitFor(() => expect(mocks.getAiAssistantUsageSummary).toHaveBeenCalledTimes(2));
  });
});

function OpenAssistantButton() {
  const assistant = useAiAssistantWorkspace();
  return (
    <button
      type="button"
      disabled={!assistant.canOpenOrderAssistant}
      onClick={assistant.openAssistant}
    >
      打开 AI
    </button>
  );
}

function renderProvider(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiAssistantWorkspaceProvider>{children}</AiAssistantWorkspaceProvider>
    </QueryClientProvider>,
  );
}
