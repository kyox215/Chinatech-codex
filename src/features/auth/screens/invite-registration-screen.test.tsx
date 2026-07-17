import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteRegistrationScreen } from "@/features/auth/screens/invite-registration-screen";
import type { OnboardingStatus } from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({
  acceptStoreInvitation: vi.fn(),
  getOnboardingStatus: vi.fn(),
  updateAccountProfile: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({ signOut: vi.fn(), updateUser: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/repairdesk/api", () => apiMocks);
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: authMocks }) }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("sonner", () => ({ toast: toastMocks }));

const invitationId = "10000000-0000-4000-8000-000000000001";

function status(withInvitation = true): OnboardingStatus {
  return {
    email: "staff@example.com",
    emailVerified: true,
    displayName: "",
    isPlatformAdmin: false,
    stores: [],
    requests: [],
    invitations: withInvitation
      ? [
          {
            id: invitationId,
            store_name: "Chinatech",
            email: "staff@example.com",
            role: "technician",
            status: "invited",
            expires_at: "2026-07-31T00:00:00.000Z",
            created_at: "2026-07-17T00:00:00.000Z",
            updated_at: "2026-07-17T00:00:00.000Z",
          },
        ]
      : [],
    availableStores: [],
  };
}

function renderScreen(mode: "new" | "existing") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InviteRegistrationScreen invitationId={invitationId} mode={mode} />
    </QueryClientProvider>,
  );
}

describe("InviteRegistrationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOnboardingStatus.mockResolvedValue(status());
    apiMocks.updateAccountProfile.mockResolvedValue(status());
    apiMocks.acceptStoreInvitation.mockResolvedValue({
      activeStore: {
        id: "store-1",
        name: "Chinatech",
        slug: "chinatech",
        role: "technician",
        status: "active",
      },
      stores: [],
    });
    authMocks.updateUser.mockResolvedValue({ error: null });
  });

  it("lets a new invited user set a name and password before atomic acceptance", async () => {
    const user = userEvent.setup();
    renderScreen("new");

    expect(await screen.findByRole("heading", { name: "加入 Chinatech" })).toBeVisible();
    await user.type(screen.getByLabelText("员工姓名"), "Mario Rossi");
    await user.type(screen.getByLabelText("设置登录密码"), "secure-pass-123");
    await user.type(screen.getByLabelText("再次输入密码"), "secure-pass-123");
    await user.click(screen.getByRole("button", { name: "创建账号并加入店铺" }));

    await waitFor(() =>
      expect(apiMocks.acceptStoreInvitation).toHaveBeenCalledWith({ id: invitationId }),
    );
    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: "secure-pass-123",
      data: { display_name: "Mario Rossi" },
    });
    expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({ display_name: "Mario Rossi" });
    expect(routerMocks.replace).toHaveBeenCalledWith("/");
  });

  it("lets an existing account accept without changing its password", async () => {
    const user = userEvent.setup();
    renderScreen("existing");

    await user.click(await screen.findByRole("button", { name: "接受邀请并进入店铺" }));
    await waitFor(() =>
      expect(apiMocks.acceptStoreInvitation).toHaveBeenCalledWith({ id: invitationId }),
    );
    expect(authMocks.updateUser).not.toHaveBeenCalled();
    expect(apiMocks.updateAccountProfile).not.toHaveBeenCalled();
  });

  it("shows a generic mismatch state without exposing another invitation", async () => {
    apiMocks.getOnboardingStatus.mockResolvedValue(status(false));
    renderScreen("existing");

    expect(await screen.findByRole("heading", { name: "邀请无法继续" })).toBeVisible();
    expect(screen.getByText(/当前登录账号与受邀邮箱不一致/)).toBeVisible();
    expect(screen.queryByText("staff@example.com")).not.toBeInTheDocument();
  });
});
