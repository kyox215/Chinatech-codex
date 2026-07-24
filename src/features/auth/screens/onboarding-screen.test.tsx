import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingRequest, OnboardingStatus } from "@/lib/repairdesk/types";

import { OnboardingScreen } from "./onboarding-screen";

const apiMocks = vi.hoisted(() => ({
  acceptStoreInvitation: vi.fn(),
  cancelOnboardingRequest: vi.fn(),
  createStore: vi.fn(),
  getOnboardingStatus: vi.fn(),
  redeemStoreInviteLink: vi.fn(),
  submitOnboardingRequest: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
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
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

function renderOnboardingScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingScreen />
    </QueryClientProvider>,
  );
}

function statusWithRequest(request: OnboardingRequest): OnboardingStatus {
  return {
    email: "staff@example.com",
    displayName: "Mario",
    isPlatformAdmin: false,
    stores: [],
    requests: [request],
    availableStores: [],
  };
}

function onboardingRequest(overrides: Partial<OnboardingRequest> = {}): OnboardingRequest {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Mario",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name,
    target_store_id: overrides.target_store_id,
    target_store_name: overrides.target_store_name,
    target_owner_email: overrides.target_owner_email ?? "owner@example.com",
    request_note: overrides.request_note,
    review_scope: overrides.review_scope ?? "platform",
    requested_role: overrides.requested_role ?? "technician",
    approved_role: overrides.approved_role,
    status: overrides.status ?? "pending",
    reviewed_by: overrides.reviewed_by,
    reviewed_by_membership_id: overrides.reviewed_by_membership_id,
    reviewed_at: overrides.reviewed_at,
    decision_note: overrides.decision_note,
    resulting_store_id: overrides.resulting_store_id,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    apiMocks.cancelOnboardingRequest.mockReset();
    apiMocks.acceptStoreInvitation.mockReset();
    apiMocks.createStore.mockReset();
    apiMocks.getOnboardingStatus.mockReset();
    apiMocks.redeemStoreInviteLink.mockReset();
    apiMocks.submitOnboardingRequest.mockReset();
    routerMocks.refresh.mockReset();
    routerMocks.replace.mockReset();
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
  });

  it("creates a new store with its own optional default print address", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      "repairdesk-create-store-request-id",
      "00000000-0000-4000-8000-000000000105",
    );
    apiMocks.getOnboardingStatus.mockResolvedValue({
      email: "owner@example.com",
      displayName: "Owner",
      isPlatformAdmin: false,
      stores: [],
      requests: [],
      invitations: [],
      availableStores: [],
    });
    apiMocks.createStore.mockResolvedValue({
      activeStore: {
        id: "store-roma",
        name: "Ripara Roma",
        slug: "ripara-roma",
        role: "owner",
        status: "active",
      },
      stores: [],
    });

    renderOnboardingScreen();

    await user.click(await screen.findByRole("tab", { name: "创建店铺" }));
    await user.type(screen.getByLabelText("店铺名称"), "Ripara Roma");
    await user.type(screen.getByLabelText("默认打印地址（可选）"), "Via Roma 12");
    await user.click(screen.getByRole("button", { name: "创建店铺" }));

    await waitFor(() =>
      expect(apiMocks.createStore).toHaveBeenCalledWith({
        request_id: "00000000-0000-4000-8000-000000000105",
        name: "Ripara Roma",
        address: "Via Roma 12",
        currency_code: "EUR",
      }),
    );
    await waitFor(() =>
      expect(window.sessionStorage.getItem("repairdesk-create-store-request-id")).toBeNull(),
    );
  });

  it("replaces a conflicting request id so edited store details can be resubmitted", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus.mockResolvedValue({
      email: "owner@example.com",
      displayName: "Owner",
      isPlatformAdmin: false,
      stores: [],
      requests: [],
      invitations: [],
      availableStores: [],
    });
    apiMocks.createStore
      .mockRejectedValueOnce(new Error("店铺资料已改变，请重新提交"))
      .mockResolvedValueOnce({
        activeStore: {
          id: "store-new",
          name: "Edited Store",
          slug: "edited-store",
          role: "owner",
          status: "active",
        },
        stores: [],
      });
    window.sessionStorage.setItem(
      "repairdesk-create-store-request-id",
      "00000000-0000-4000-8000-000000000106",
    );

    renderOnboardingScreen();
    await user.click(await screen.findByRole("tab", { name: "创建店铺" }));
    await user.type(screen.getByLabelText("店铺名称"), "Edited Store");
    await user.click(screen.getByRole("button", { name: "创建店铺" }));
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem("repairdesk-create-store-request-id")).toBeNull();

    await user.click(screen.getByRole("button", { name: "创建店铺" }));
    await waitFor(() => expect(apiMocks.createStore).toHaveBeenCalledTimes(2));
    expect(apiMocks.createStore.mock.calls[1]?.[0].request_id).not.toBe(
      "00000000-0000-4000-8000-000000000106",
    );
  });

  it("lets an applicant cancel a pending onboarding request", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus.mockResolvedValue(
      statusWithRequest(onboardingRequest({ status: "pending" })),
    );
    apiMocks.cancelOnboardingRequest.mockResolvedValue(onboardingRequest({ status: "cancelled" }));

    renderOnboardingScreen();

    expect(await screen.findByRole("heading", { name: "申请待审核" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /撤回申请/ }));

    await waitFor(() => {
      expect(apiMocks.cancelOnboardingRequest).toHaveBeenCalledWith({
        id: "00000000-0000-4000-8000-000000000001",
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("申请已撤回");
  });

  it("shows rejected reasons and keeps the join form available for resubmission", async () => {
    apiMocks.getOnboardingStatus.mockResolvedValue(
      statusWithRequest(
        onboardingRequest({
          status: "rejected",
          decision_note: "资料不完整，请补充店铺负责人确认信息。",
          updated_at: "2026-06-18T09:00:00.000Z",
        }),
      ),
    );

    renderOnboardingScreen();

    expect(await screen.findByRole("heading", { name: "申请未通过" })).toBeInTheDocument();
    expect(screen.getByText("资料不完整，请补充店铺负责人确认信息。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新提交申请/ })).toBeInTheDocument();
    expect(screen.getByLabelText("店铺负责人邮箱")).toBeInTheDocument();
  });

  it("lets an invited applicant accept the store invitation before getting access", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus.mockResolvedValue({
      email: "staff@example.com",
      displayName: "Mario",
      isPlatformAdmin: false,
      stores: [],
      requests: [],
      invitations: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          store_id: "store_1",
          store_name: "Demo Repair Store",
          email: "staff@example.com",
          role: "viewer",
          status: "invited",
          expires_at: "2026-07-18T09:00:00.000Z",
          created_at: "2026-07-04T09:00:00.000Z",
          updated_at: "2026-07-04T09:00:00.000Z",
        },
      ],
      availableStores: [],
    });
    apiMocks.acceptStoreInvitation.mockResolvedValue({
      activeStore: {
        id: "store_1",
        name: "Demo Repair Store",
        slug: "demo-repair-store",
        role: "viewer",
        status: "active",
      },
      stores: [],
    });

    renderOnboardingScreen();

    expect(await screen.findByRole("heading", { name: "待接受邀请" })).toBeInTheDocument();
    expect(screen.getByText(/接受前不会开通店铺权限/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /接受邀请/ }));

    await waitFor(() => {
      expect(apiMocks.acceptStoreInvitation).toHaveBeenCalledWith({
        id: "00000000-0000-4000-8000-000000000101",
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("邀请已接受");
  });

  it("lets an applicant redeem an invite code into a pending invitation", async () => {
    const user = userEvent.setup();
    apiMocks.getOnboardingStatus.mockResolvedValue({
      email: "staff@example.com",
      displayName: "Mario",
      isPlatformAdmin: false,
      stores: [],
      requests: [],
      invitations: [],
      availableStores: [],
    });
    apiMocks.redeemStoreInviteLink.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      store_name: "Demo Repair Store",
      email: "staff@example.com",
      role: "viewer",
      status: "invited",
      expires_at: "2026-07-18T09:00:00.000Z",
      created_at: "2026-07-04T09:00:00.000Z",
      updated_at: "2026-07-04T09:00:00.000Z",
    });

    renderOnboardingScreen();

    await user.type(await screen.findByLabelText("邀请码"), "rd_valid_invite_code");
    await user.click(screen.getByRole("button", { name: /兑换/ }));

    await waitFor(() => {
      expect(apiMocks.redeemStoreInviteLink).toHaveBeenCalledWith({
        code: "rd_valid_invite_code",
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("邀请码已兑换，请接受邀请");
    expect(routerMocks.replace).not.toHaveBeenCalledWith("/");
  });
});
