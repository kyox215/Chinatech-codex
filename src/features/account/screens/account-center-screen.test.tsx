import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingStatus } from "@/lib/repairdesk/types";

import { AccountCenterScreen } from "./account-center-screen";

const apiMocks = vi.hoisted(() => ({
  getOnboardingStatus: vi.fn(),
  updateAccountProfile: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", () => apiMocks);

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

function accountStatus(email?: string): OnboardingStatus {
  const activeStore = {
    id: "00000000-0000-4000-8000-000000000001",
    membershipId: "00000000-0000-4000-8000-000000000002",
    name: "QA Store",
    slug: "qa-store",
    role: "owner" as const,
    status: "active" as const,
  };
  return {
    email,
    emailVerified: Boolean(email),
    displayName: "QA Owner",
    phoneE164: "+39 000 000 000",
    isPlatformAdmin: false,
    activeStore,
    stores: [activeStore],
    requests: [],
    availableStores: [],
  };
}

function renderAccountCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountCenterScreen />
    </QueryClientProvider>,
  );
}

describe("AccountCenterScreen password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOnboardingStatus.mockResolvedValue(accountStatus("qa@example.test"));
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("sends the current normalized account email to the safe reset callback", async () => {
    const user = userEvent.setup();
    renderAccountCenter();

    await user.click(await screen.findByRole("button", { name: "发送重置邮件" }));

    await waitFor(() => {
      expect(authMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("qa@example.test", {
      redirectTo: expect.stringMatching(/\/auth\/callback\?next=%2Freset-password$/),
    });
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it("keeps the action disabled when no current login email is available", async () => {
    apiMocks.getOnboardingStatus.mockResolvedValue(accountStatus());
    renderAccountCenter();

    const button = await screen.findByRole("button", { name: "发送重置邮件" });
    expect(button).toBeDisabled();
    expect(screen.getByText("未读取当前登录邮箱")).toBeInTheDocument();
    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("disables the action while pending so rapid clicks cannot send twice", async () => {
    let finishRequest: ((value: { error: null }) => void) | undefined;
    authMocks.resetPasswordForEmail.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        finishRequest = resolve;
      }),
    );
    const user = userEvent.setup();
    renderAccountCenter();

    const button = await screen.findByRole("button", { name: "发送重置邮件" });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);

    finishRequest?.({ error: null });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("shows a safe error toast when Supabase rejects the request", async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({
      error: { message: "rate limit exceeded" },
    });
    const user = userEvent.setup();
    renderAccountCenter();

    await user.click(await screen.findByRole("button", { name: "发送重置邮件" }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledTimes(1));
    expect(toastMocks.success).not.toHaveBeenCalled();
  });
});
