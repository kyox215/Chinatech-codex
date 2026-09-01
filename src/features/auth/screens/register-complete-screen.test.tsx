import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingStatus } from "@/lib/repairdesk/types";

import { RegisterCompleteScreen } from "./register-complete-screen";

const apiMocks = vi.hoisted(() => ({ getOnboardingStatus: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/repairdesk/api", () => apiMocks);
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

function onboardingStatus(): OnboardingStatus {
  return {
    email: "staff@example.com",
    displayName: "Mario",
    isPlatformAdmin: false,
    stores: [],
    requests: [],
    invitations: [],
    availableStores: [],
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterCompleteScreen />
    </QueryClientProvider>,
  );
}

describe("RegisterCompleteScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a focused safe error and only reveals success after a successful retry", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus
      .mockRejectedValueOnce(new Error("raw provider failure"))
      .mockResolvedValueOnce(onboardingStatus());

    renderScreen();

    expect(await screen.findByRole("heading", { name: "无法确认注册状态" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "注册已完成" })).not.toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).not.toHaveTextContent("raw provider failure");
    await waitFor(() => expect(alert).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByRole("heading", { name: "注册已完成" })).toBeVisible();
    expect(apiMocks.getOnboardingStatus).toHaveBeenCalledTimes(2);
  });

  it("continues only after the status query succeeds", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus.mockResolvedValue(onboardingStatus());

    renderScreen();

    await user.click(await screen.findByRole("button", { name: "继续店铺开通" }));

    expect(routerMocks.replace).toHaveBeenCalledWith("/onboarding");
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
