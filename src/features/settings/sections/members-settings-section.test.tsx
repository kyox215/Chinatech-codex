import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/components/unsaved-settings-guard", () => ({
  UnsavedSettingsGuard: () => null,
}));

import { MembersSettingsSection } from "@/features/settings/sections/members-settings-section";
import {
  emailDeliveryLabel,
  formatMemberDate,
} from "@/features/settings/sections/member-invite-tools";
import type { OnboardingRequest, StoreInvitation, StoreMember } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

afterEach(cleanup);

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

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

const inactiveTechnician: StoreMember = {
  ...technician,
  id: "inactive-membership",
  user_id: "inactive-user",
  email: "inactive@example.test",
  display_name: "Inactive Technician",
  status: "inactive",
  management: {
    allowed_roles: [],
    can_update_role: false,
    can_update_permissions: false,
    can_disable: false,
    can_restore: true,
  },
};

const invitation: StoreInvitation = {
  id: "invitation-a",
  store_id: "store-a",
  email: "invited@example.test",
  role: "viewer",
  status: "invited",
  email_delivery_status: "sent",
  expires_at: "2099-07-13T00:00:00.000Z",
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

const inviteLink = {
  id: "link-a",
  store_id: "store-a",
  label: "Front desk",
  role: "viewer" as const,
  status: "active" as const,
  expires_at: "2099-07-13T00:00:00.000Z",
  max_uses: 1,
  used_count: 0,
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

let setLocaleForTest: ReturnType<typeof useLocale>["setLocale"] | undefined;

function LocaleController() {
  setLocaleForTest = useLocale().setLocale;
  return null;
}

describe("MembersSettingsSection", () => {
  it("keeps loaded members visible when the independent access-request query fails", () => {
    renderMembers({ isAccessRequestsError: true });

    expect(screen.getAllByText("Owner")[0]).toBeVisible();
    expect(screen.getByText("加入申请读取失败")).toBeVisible();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
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

    await waitFor(() => expect(onSaveMember).toHaveBeenCalledTimes(1));
    expect(onSaveMember).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tech-membership" }),
      expect.objectContaining({
        role: "technician",
        permissions: ["supplier:read", "supplier:assign", "supplier:manage"],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("requires standard confirmation before disabling a member", async () => {
    const onDisableMember = vi.fn().mockResolvedValue(undefined);
    renderMembers({ onDisableMember });

    fireEvent.click(screen.getAllByRole("button", { name: "停用" })[0]);
    const dialog = screen.getByRole("alertdialog", { name: "停用这名员工？" });
    expect(dialog).toHaveTextContent("额外授权会被撤销");
    expect(onDisableMember).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(onDisableMember).toHaveBeenCalledWith("tech-membership"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
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

  it("puts the member list first and makes email invitation the primary disclosure", () => {
    const invitation: StoreInvitation = {
      id: "invitation-a",
      store_id: "store-a",
      email: "new@example.com",
      role: "viewer",
      status: "invited",
      email_delivery_status: "sent",
      expires_at: "2099-07-13T00:00:00.000Z",
      created_at: "2026-07-12T00:00:00.000Z",
      updated_at: "2026-07-12T00:00:00.000Z",
    };
    renderMembers({ invitations: [invitation] });

    const section = screen.getByRole("heading", { name: "员工与权限" }).closest("section");
    expect(section).not.toBeNull();
    expect(
      within(section as HTMLElement).getByRole("heading", { name: "店铺成员" }),
    ).toBeInTheDocument();
    const emailTrigger = within(section as HTMLElement).getByRole("button", {
      name: /邮件邀请员工/,
    });
    const linkTrigger = within(section as HTMLElement).getByRole("button", { name: /邀请码/ });
    expect(emailTrigger).toHaveAttribute("aria-expanded", "true");
    expect(linkTrigger).toHaveAttribute("aria-expanded", "false");
    expect(emailTrigger).toHaveClass("min-h-11");
    expect(within(section as HTMLElement).queryByText("1 封邀请等待接受")).not.toBeInTheDocument();
  });

  it.each([
    ["it-IT", "Personale e autorizzazioni", "Gestisci", "Tecnico", "Gestisci fornitori"],
    ["en", "Staff and permissions", "Manage", "Technician", "Manage suppliers"],
  ] as const)(
    "localizes the mounted role and action matrix in %s while preserving member data and payloads",
    async (locale, title, manage, role, permission) => {
      const onSaveMember = vi.fn().mockResolvedValue(undefined);
      renderMembers({ accessRequests: [accessRequest], onSaveMember }, locale);

      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getAllByText(role).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText("technician-with-a-very-long-email@example.test").length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("Front desk support")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: manage })[0]);
      fireEvent.click(screen.getByLabelText(permission));
      fireEvent.click(
        screen.getByRole("button", {
          name: locale === "it-IT" ? "Salva modifiche membro" : "Save staff changes",
        }),
      );
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: locale === "it-IT" ? "Conferma e salva" : "Confirm and save",
        }),
      );

      await waitFor(() => expect(onSaveMember).toHaveBeenCalledTimes(1));
      expect(onSaveMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: "tech-membership" }),
        {
          role: "technician",
          permissions: ["supplier:read", "supplier:assign", "supplier:manage"],
        },
      );
    },
  );

  it("renders a safe localized action error instead of a raw provider sentinel", () => {
    renderMembers({ actionError: "RAW_PROVIDER_SENTINEL" }, "en");

    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "The staff action failed. Try again.",
    );
    expect(document.body).not.toHaveTextContent("RAW_PROVIDER_SENTINEL");
  });

  it.each([
    ["zh-CN", "发送邀请邮件", "邀请码", "生成当前店铺邀请码", "重新发送"],
    [
      "it-IT",
      "Invia email di invito",
      "Codice di invito",
      "Genera codice per il negozio corrente",
      "Invia di nuovo",
    ],
    [
      "en",
      "Send invitation email",
      "Invitation code",
      "Generate code for current store",
      "Send again",
    ],
  ] as const)(
    "locks email, link, and resend submissions and preserves exact bodies in %s",
    async (locale, sendLabel, codeLabel, generateLabel, resendLabel) => {
      let resolveInvite!: () => void;
      let resolveLink!: () => void;
      const onInvite = vi.fn().mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveInvite = resolve;
        }),
      );
      const onCreateInviteLink = vi.fn().mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveLink = resolve;
        }),
      );
      renderMembers({ invitations: [invitation], onInvite, onCreateInviteLink }, locale);

      const emailInput = document.getElementById("invite-email") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "  Staff@Example.TEST  " } });
      const send = screen.getByRole("button", { name: sendLabel });
      fireEvent.click(send);
      fireEvent.click(send);
      expect(onInvite).toHaveBeenCalledTimes(1);
      expect(onInvite).toHaveBeenCalledWith({ email: "Staff@Example.TEST", role: "manager" });
      expect(emailInput).toHaveValue("Staff@Example.TEST");
      await act(async () => resolveInvite());
      await waitFor(() => expect(emailInput).toHaveValue(""));

      fireEvent.click(screen.getByRole("button", { name: new RegExp(codeLabel) }));
      const labelInput = document.getElementById("invite-code-label") as HTMLInputElement;
      fireEvent.change(labelInput, { target: { value: "  Front Desk  " } });
      const generate = screen.getByRole("button", { name: generateLabel });
      fireEvent.click(generate);
      fireEvent.click(generate);
      expect(onCreateInviteLink).toHaveBeenCalledTimes(1);
      expect(onCreateInviteLink).toHaveBeenCalledWith({
        label: "Front Desk",
        role: "manager",
        expires_in_days: 7,
        max_uses: 1,
      });
      expect(labelInput).toHaveValue("  Front Desk  ");
      await act(async () => resolveLink());
      await waitFor(() => expect(labelInput).toHaveValue(""));

      onInvite.mockClear().mockResolvedValueOnce(undefined);
      const resend = screen.getByRole("button", { name: resendLabel });
      fireEvent.click(resend);
      fireEvent.click(resend);
      expect(onInvite).toHaveBeenCalledTimes(1);
      expect(onInvite).toHaveBeenCalledWith({ email: "invited@example.test", role: "viewer" });
    },
  );

  it("submits role, restore, invitation/link revoke, and reject actions exactly once", async () => {
    const onSaveMember = vi.fn().mockResolvedValue(undefined);
    const onRestoreMember = vi.fn().mockResolvedValue(undefined);
    const onRevokeInvitation = vi.fn().mockResolvedValue(undefined);
    const onRevokeInviteLink = vi.fn().mockResolvedValue(undefined);
    const onRejectAccessRequest = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderMembers({
      members: [owner, technician, inactiveTechnician],
      invitations: [invitation],
      inviteLinks: [inviteLink],
      accessRequests: [accessRequest],
      onSaveMember,
      onRestoreMember,
      onRevokeInvitation,
      onRevokeInviteLink,
      onRejectAccessRequest,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "管理" })[0]);
    const editor = screen.getByRole("dialog", { name: "Technician" });
    const roleSelect = within(editor).getByRole("combobox");
    await user.click(roleSelect);
    await user.click(screen.getByRole("option", { name: "店长" }));
    fireEvent.click(within(editor).getByRole("button", { name: "保存员工变更" }));
    const roleConfirm = screen.getByRole("alertdialog", { name: "确认授予敏感员工权限？" });
    const roleAction = within(roleConfirm).getByRole("button", { name: "确认并保存" });
    fireEvent.click(roleAction);
    fireEvent.click(roleAction);
    await waitFor(() => expect(onSaveMember).toHaveBeenCalledTimes(1));
    expect(onSaveMember).toHaveBeenCalledWith(expect.objectContaining({ id: "tech-membership" }), {
      role: "manager",
      permissions: ["supplier:read"],
    });

    await waitFor(() => expect(editor).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "恢复" })[0]);
    const restoreDialog = screen.getByRole("alertdialog", { name: "恢复这名员工？" });
    const restoreAction = within(restoreDialog).getByRole("button", { name: "确认操作" });
    fireEvent.click(restoreAction);
    fireEvent.click(restoreAction);
    await waitFor(() => expect(onRestoreMember).toHaveBeenCalledTimes(1));
    expect(onRestoreMember).toHaveBeenCalledWith("inactive-membership");

    await waitFor(() => expect(restoreDialog).not.toBeInTheDocument());
    const revokeButtons = screen.getAllByRole("button", { name: "撤销" });
    fireEvent.click(revokeButtons[0]);
    const invitationDialog = screen.getByRole("alertdialog", { name: "撤销待接受邀请？" });
    fireEvent.click(within(invitationDialog).getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(onRevokeInvitation).toHaveBeenCalledTimes(1));
    expect(onRevokeInvitation).toHaveBeenCalledWith("invitation-a");

    await waitFor(() => expect(invitationDialog).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /邀请码/ }));
    const linkCard = screen.getByText("Front desk").parentElement?.parentElement;
    expect(linkCard).not.toBeNull();
    fireEvent.click(within(linkCard as HTMLElement).getByRole("button", { name: "撤销" }));
    const linkDialog = screen.getByRole("alertdialog", { name: "撤销当前邀请码？" });
    fireEvent.click(within(linkDialog).getByRole("button", { name: "确认操作" }));
    await waitFor(() => expect(onRevokeInviteLink).toHaveBeenCalledTimes(1));
    expect(onRevokeInviteLink).toHaveBeenCalledWith("link-a");

    await waitFor(() => expect(linkDialog).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    const rejectDialog = screen.getByRole("alertdialog", { name: "拒绝加入申请？" });
    const rejectAction = within(rejectDialog).getByRole("button", { name: "确认拒绝" });
    fireEvent.click(rejectAction);
    fireEvent.click(rejectAction);
    await waitFor(() => expect(onRejectAccessRequest).toHaveBeenCalledTimes(1));
    expect(onRejectAccessRequest).toHaveBeenCalledWith(accessRequest.id);
  });

  it("preserves a focused access-role draft across locale change without requests", async () => {
    const user = userEvent.setup();
    const callbacks = {
      onApproveAccessRequest: vi.fn().mockResolvedValue(undefined),
      onRejectAccessRequest: vi.fn().mockResolvedValue(undefined),
    };
    renderMembers({ accessRequests: [accessRequest], ...callbacks }, "zh-CN", true);
    const roleSelect = screen.getByRole("combobox", { name: "批准后的角色" });
    await user.click(roleSelect);
    await user.click(screen.getByRole("option", { name: "店长" }));
    roleSelect.focus();
    expect(roleSelect).toHaveFocus();

    act(() => setLocaleForTest?.("it-IT"));

    const localizedSelect = screen.getByRole("combobox", { name: "Ruolo dopo l’approvazione" });
    expect(localizedSelect).toBe(roleSelect);
    expect(localizedSelect).toHaveTextContent("Responsabile");
    expect(localizedSelect).toHaveFocus();
    expect(callbacks.onApproveAccessRequest).not.toHaveBeenCalled();
    expect(callbacks.onRejectAccessRequest).not.toHaveBeenCalled();
  });

  it("formats invitation dates in Rome and localizes stable delivery status codes", () => {
    const nearMidnightUtc = "2026-07-12T23:30:00.000Z";
    expect(formatMemberDate(nearMidnightUtc, "it-IT")).toBe("13/07");
    expect(formatMemberDate(nearMidnightUtc, "en")).toBe("07/13");
    expect(formatMemberDate("not-a-date", "zh-CN")).toBe("");
    expect(formatMemberDate("not-a-date", "it-IT")).toBe("");
    expect(formatMemberDate("not-a-date", "en")).toBe("");
    expect(formatMemberDate("2026-03-28T23:30:00.000Z", "it-IT")).toBe("29/03");
    expect(formatMemberDate("2026-03-28T23:30:00.000Z", "en")).toBe("03/29");
    expect(formatMemberDate("2026-10-24T22:30:00.000Z", "it-IT")).toBe("25/10");
    expect(formatMemberDate("2026-10-24T22:30:00.000Z", "en")).toBe("10/25");
    expect(emailDeliveryLabel("sent", "zh-CN")).toBe("邮件已发送");
    expect(emailDeliveryLabel("sent", "it-IT")).toBe("Email inviata");
    expect(emailDeliveryLabel("sent", "en")).toBe("Email sent");
    expect(emailDeliveryLabel(undefined, "en")).toBe("Not sent yet");
  });
});

function renderMembers(
  overrides: Partial<React.ComponentProps<typeof MembersSettingsSection>> = {},
  locale: AppLocale = "zh-CN",
  withLocaleController = false,
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
    orderCostsEnabled: true,
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
  return render(
    <LocaleProvider initialLocale={locale}>
      {withLocaleController ? <LocaleController /> : null}
      <MembersSettingsSection {...props} />
    </LocaleProvider>,
  );
}
