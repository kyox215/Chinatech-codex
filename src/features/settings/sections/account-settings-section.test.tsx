import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopVirtualKeyboardPreferenceContext } from "@/components/desktop-virtual-keyboard-preference-context";
import type { AccountSettingsSummary } from "@/features/settings/model/account-settings-summary";
import { AccountSettingsSection } from "@/features/settings/sections/account-settings-section";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

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
        saveError="RAW_PROVIDER_SENTINEL"
        onNameDraftChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "名称保存失败。草稿仍保留，可再次点击“保存名称”重试。",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("RAW_PROVIDER_SENTINEL");
    expect(screen.getByLabelText("显示名称")).toHaveValue("Mario Pending");
    expect(screen.getByRole("button", { name: "保存名称" })).toBeEnabled();
  });

  it.each([
    ["zh-CN", "我的账号", "打开个人中心"],
    ["it-IT", "Il mio account", "Apri profilo personale"],
    ["en", "My account", "Open personal profile"],
  ] as const)(
    "renders fixed account UI in %s while preserving dynamic values",
    (locale, title, link) => {
      render(
        <LocaleProvider initialLocale={locale as AppLocale}>
          <AccountSettingsSection
            summary={summary}
            isLoading={false}
            nameDraft="Mario Dynamic"
            hasNameChange={false}
            isSaving={false}
            onNameDraftChange={vi.fn()}
            onSave={vi.fn()}
          />
        </LocaleProvider>,
      );

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", "/account");
      expect(screen.getByDisplayValue("Mario Dynamic")).toBeInTheDocument();
      expect(screen.getByText("owner@example.test")).toBeInTheDocument();
      expect(screen.getByText("Repair Lab")).toBeInTheDocument();
    },
  );

  it("lets a user choose whether their desktop browser shows virtual keyboards", async () => {
    const user = userEvent.setup();
    const setDesktopVirtualKeyboardEnabled = vi.fn();
    render(
      <DesktopVirtualKeyboardPreferenceContext.Provider
        value={{
          desktopVirtualKeyboardEnabled: false,
          preferenceReady: true,
          setDesktopVirtualKeyboardEnabled,
        }}
      >
        <AccountSettingsSection
          summary={summary}
          isLoading={false}
          nameDraft="Mario"
          hasNameChange={false}
          isSaving={false}
          onNameDraftChange={vi.fn()}
          onSave={vi.fn()}
        />
      </DesktopVirtualKeyboardPreferenceContext.Provider>,
    );

    expect(screen.getByText("桌面端显示虚拟键盘")).toBeInTheDocument();
    expect(screen.getByText("当前电脑端会使用普通输入框。")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "桌面端显示虚拟键盘" }));
    expect(setDesktopVirtualKeyboardEnabled).toHaveBeenCalledWith(true);
  });
});
