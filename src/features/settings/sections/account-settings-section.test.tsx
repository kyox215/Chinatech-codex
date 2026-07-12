import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccountSettingsSummary } from "@/features/settings/model/account-settings-summary";
import { AccountSettingsSection } from "@/features/settings/sections/account-settings-section";

afterEach(cleanup);

const summary: AccountSettingsSummary = {
  email: "owner@example.test",
  emailVerificationState: "verified",
  accountNature: "门店成员账号",
  activeStoreName: "Repair Lab",
  currentStoreRole: "店主",
};

describe("AccountSettingsSection", () => {
  it("uses a neutral skeleton without inferring identity while loading", () => {
    const { container } = render(
      <AccountSettingsSection
        isLoading
        nameDraft=""
        hasNameChange={false}
        isSaving={false}
        onNameDraftChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-ui="settings-account-loading"]')).toBeInTheDocument();
    expect(screen.queryByText("未验证")).not.toBeInTheDocument();
    expect(screen.queryByText("当前无店铺角色")).not.toBeInTheDocument();
  });

  it("shows account nature, email verification, store role, and the exact security link", () => {
    render(
      <AccountSettingsSection
        summary={summary}
        isLoading={false}
        nameDraft="Mario"
        hasNameChange={false}
        isSaving={false}
        onNameDraftChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("门店成员账号")).toBeInTheDocument();
    expect(screen.getByText("店主")).toBeInTheDocument();
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
    expect(screen.getByText("已验证")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开个人中心" })).toHaveAttribute("href", "/account");
  });

  it("keeps display-name editing self-contained and blocks an empty save", async () => {
    const user = userEvent.setup();
    const onNameDraftChange = vi.fn();
    const onSave = vi.fn();
    const view = render(
      <AccountSettingsSection
        summary={summary}
        isLoading={false}
        nameDraft="Mario Rossi"
        hasNameChange
        isSaving={false}
        onNameDraftChange={onNameDraftChange}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存名称" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "Luigi" } });
    expect(onNameDraftChange).toHaveBeenCalledWith("Luigi");

    view.rerender(
      <AccountSettingsSection
        summary={summary}
        isLoading={false}
        nameDraft=""
        hasNameChange={false}
        isSaving={false}
        onNameDraftChange={onNameDraftChange}
        onSave={onSave}
      />,
    );
    expect(screen.getByText("显示名称不能为空")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存名称" })).toBeDisabled();
  });

  it("keeps a failed account-name draft recoverable with inline feedback", () => {
    render(
      <AccountSettingsSection
        summary={summary}
        isLoading={false}
        nameDraft="Mario Pending"
        hasNameChange
        isSaving={false}
        saveError="network unavailable"
        onNameDraftChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("名称保存失败：network unavailable");
    expect(screen.getByLabelText("显示名称")).toHaveValue("Mario Pending");
    expect(screen.getByRole("button", { name: "保存名称" })).toBeEnabled();
  });
});
