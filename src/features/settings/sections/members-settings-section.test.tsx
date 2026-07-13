import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

import { MembersSettingsSection } from "@/features/settings/sections/members-settings-section";
import type { OnboardingRequest, StoreMember } from "@/lib/repairdesk/types";

afterEach(cleanup);

const owner: StoreMember = {
  id: "owner-membership",
  user_id: "owner-user",
  email: "owner@example.com",
  display_name: "Owner",
  role: "owner",
  status: "active",
  permission_grants: [],
  management: {
    allowed_roles: [],
    can_update_role: false,
    can_update_permissions: false,
    can_disable: false,
    can_restore: false,
  },
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const technician: StoreMember = {
  ...owner,
  id: "tech-membership",
  user_id: "tech-user",
  email: "technician-with-a-very-long-email@example.test",
  display_name: "Technician",
  role: "technician",
  permission_grants: ["supplier:read"],
  management: {
    allowed_roles: ["manager", "technician", "sales", "viewer"],
    can_update_role: true,
    can_update_permissions: true,
    can_disable: true,
    can_restore: false,
  },
};

const accessRequest: OnboardingRequest = {
  id: "20000000-0000-4000-8000-000000000001",
  requester_user_id: "applicant-user",
  email: "applicant@example.com",
  display_name: "Applicant",
  request_type: "join_store",
  target_store_id: "store-1",
  target_store_name: "Store 1",
  request_note: "Front desk support",
  review_scope: "store",
  requested_role: "sales",
  status: "pending",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("MembersSettingsSection", () => {
  it("keeps loaded members visible when the independent access-request query fails", () => {
    renderMembers({ isAccessRequestsError: true });

    expect(screen.getAllByText("Owner")[0]).toBeVisible();
    expect(screen.getByText("加入申请读取失败")).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
    expect(screen.getByRole("button", { name: /重新读取申请/ })).toBeVisible();
  });

  it("stages permission changes in the sheet and submits only after explicit confirmation", async () => {
    const onSaveMember = vi.fn().mockResolvedValue(undefined);
    renderMembers({ onSaveMember });

    fireEvent.click(screen.getAllByRole("button", { name: "管理" })[0]);
    expect(screen.getByRole("dialog", { name: "Technician" })).toBeVisible();

    fireEvent.click(screen.getByLabelText("管理供应商"));
    expect(onSaveMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存员工变更" }));
    const confirm = screen.getByRole("alertdialog", { name: "确认授予敏感员工权限？" });
    expect(onSaveMember).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "确认并保存" }));

    expect(onSaveMember).toHaveBeenCalledTimes(1);
    expect(onSaveMember).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tech-membership" }),
      expect.objectContaining({
        role: "technician",
        permissions: ["supplier:read", "supplier:assign", "supplier:manage"],
      }),
    );
  });

  it("requires standard confirmation before disabling a member", () => {
    const onDisableMember = vi.fn().mockResolvedValue(undefined);
    renderMembers({ onDisableMember });

    fireEvent.click(screen.getAllByRole("button", { name: "停用" })[0]);
    const dialog = screen.getByRole("alertdialog", { name: "停用这名员工？" });
    expect(dialog).toHaveTextContent("额外授权会被撤销");
    expect(onDisableMember).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认操作" }));
    expect(onDisableMember).toHaveBeenCalledWith("tech-membership");
  });

  it("locks a dangerous confirmation against duplicate requests and restores focus", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((nextResolve) => {
      resolve = nextResolve;
    });
    const onDisableMember = vi.fn().mockReturnValue(pending);
    renderMembers({ onDisableMember });

    const trigger = screen.getAllByRole("button", { name: "停用" })[0];
    fireEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "停用这名员工？" });
    const confirm = within(dialog).getByRole("button", { name: "确认操作" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onDisableMember).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("button", { name: "处理中…" })).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps a failed sensitive-save confirmation open with an inline error", async () => {
    const onSaveMember = vi.fn().mockRejectedValue(new Error("network failed"));
    renderMembers({ onSaveMember, memberSaveError: "员工权限保存失败，请重试" });

    fireEvent.click(screen.getAllByRole("button", { name: "管理" })[0]);
    fireEvent.click(screen.getByLabelText("管理供应商"));
    fireEvent.click(screen.getByRole("button", { name: "保存员工变更" }));
    const dialog = screen.getByRole("alertdialog", { name: "确认授予敏感员工权限？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认并保存" }));

    await waitFor(() => expect(onSaveMember).toHaveBeenCalledTimes(1));
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("员工权限保存失败，请重试");
  });

  it("confirms an access approval once and returns focus to its trigger", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((nextResolve) => {
      resolve = nextResolve;
    });
    const onApproveAccessRequest = vi.fn().mockReturnValue(pending);
    renderMembers({ accessRequests: [accessRequest], onApproveAccessRequest });

    const trigger = screen.getByRole("button", { name: "批准" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "批准加入当前店铺？" });
    const confirm = within(dialog).getByRole("button", { name: "确认批准" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onApproveAccessRequest).toHaveBeenCalledTimes(1);
    expect(onApproveAccessRequest).toHaveBeenCalledWith(accessRequest.id, "sales");
    expect(within(dialog).getByRole("button", { name: "处理中…" })).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

function renderMembers(
  overrides: Partial<React.ComponentProps<typeof MembersSettingsSection>> = {},
) {
  const props: React.ComponentProps<typeof MembersSettingsSection> = {
    members: [owner, technician],
    invitations: [],
    inviteLinks: [],
    accessRequests: [],
    currentMembershipId: "owner-membership",
    inviteRoleOptions: ["manager", "technician", "sales", "viewer"],
    canInviteMembers: true,
    canRevokeMembers: true,
    canReviewAccessRequests: true,
    isLoading: false,
    isError: false,
    isAccessRequestsLoading: false,
    isAccessRequestsError: false,
    isInviting: false,
    isCreatingInviteLink: false,
    isRevokingInvitation: false,
    isRevokingInviteLink: false,
    isSavingMember: false,
    isReviewingAccessRequest: false,
    latestInviteCode: "",
    onRetryMembers: vi.fn(),
    onRetryAccessRequests: vi.fn(),
    onInvite: vi.fn().mockResolvedValue(undefined),
    onCreateInviteLink: vi.fn().mockResolvedValue(undefined),
    onCopyInviteCode: vi.fn(),
    onSaveMember: vi.fn().mockResolvedValue(undefined),
    onDisableMember: vi.fn().mockResolvedValue(undefined),
    onRestoreMember: vi.fn().mockResolvedValue(undefined),
    onRevokeInvitation: vi.fn().mockResolvedValue(undefined),
    onRevokeInviteLink: vi.fn().mockResolvedValue(undefined),
    onApproveAccessRequest: vi.fn().mockResolvedValue(undefined),
    onRejectAccessRequest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<MembersSettingsSection {...props} />);
}
