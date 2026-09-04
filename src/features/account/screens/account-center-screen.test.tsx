import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingStatus } from "@/lib/repairdesk/types";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

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

function accountStatus(email?: string, emailVerified = Boolean(email)): OnboardingStatus {
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
    emailVerified,
    displayName: "QA Owner",
    phoneE164: "+39 000 000 000",
    isPlatformAdmin: false,
    activeStore,
    stores: [activeStore],
    requests: [],
    availableStores: [],
  };
}

let setLocaleForTest: ReturnType<typeof useLocale>["setLocale"] | undefined;

function LocaleController() {
  setLocaleForTest = useLocale().setLocale;
  return null;
}

function renderAccountCenter(locale: AppLocale = "zh-CN", withLocaleController = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>
        {withLocaleController ? <LocaleController /> : null}
        <AccountCenterScreen />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

const accountActionCopy = {
  "zh-CN": {
    displayName: "显示名称",
    saveProfile: "保存资料",
    profileError: "保存个人资料失败，请重试",
    updatePassword: "更新密码",
    sendReset: "发送重置邮件",
    resendVerification: "重发验证",
    sendEmailChange: "发送换绑邮件",
    providerError: "操作失败，请稍后再试",
  },
  "it-IT": {
    displayName: "Nome visualizzato",
    saveProfile: "Salva profilo",
    profileError: "Impossibile salvare il profilo. Riprova",
    updatePassword: "Aggiorna password",
    sendReset: "Invia email di ripristino",
    resendVerification: "Invia di nuovo la verifica",
    sendEmailChange: "Invia email di modifica",
    providerError: "Operazione non riuscita. Riprova più tardi.",
  },
  en: {
    displayName: "Display name",
    saveProfile: "Save profile",
    profileError: "Could not save the profile. Try again",
    updatePassword: "Update password",
    sendReset: "Send reset email",
    resendVerification: "Resend verification",
    sendEmailChange: "Send email change message",
    providerError: "The operation failed. Try again later.",
  },
} as const;

describe("AccountCenterScreen password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOnboardingStatus.mockResolvedValue(accountStatus("qa@example.test"));
    apiMocks.updateAccountProfile.mockResolvedValue(accountStatus("qa@example.test"));
    authMocks.resend.mockResolvedValue({ error: null });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
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
    expect(screen.getByText("当前登录邮箱不可用，请刷新后重试")).toBeInTheDocument();
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
    expect(toastMocks.error).toHaveBeenCalledWith("操作太频繁，请稍后再试。");
    expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("rate limit exceeded");
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it.each([
    ["zh-CN", "个人中心", "保存资料"],
    ["it-IT", "Profilo personale", "Salva profilo"],
    ["en", "Personal profile", "Save profile"],
  ] as const)(
    "renders fixed account UI in %s without changing dynamic values",
    async (locale, title, saveLabel) => {
      renderAccountCenter(locale);

      expect(await screen.findByRole("button", { name: saveLabel })).toBeInTheDocument();
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getAllByText("qa@example.test").length).toBeGreaterThan(0);
      expect(screen.getByText("QA Store")).toBeInTheDocument();
      expect(apiMocks.getOnboardingStatus).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves a focused profile draft and performs no request when locale changes", async () => {
    const user = userEvent.setup();
    renderAccountCenter("zh-CN", true);
    const input = await screen.findByLabelText("显示名称");
    await user.clear(input);
    await user.type(input, "Mario Focus Draft");
    input.focus();
    expect(input).toHaveFocus();
    const readCount = apiMocks.getOnboardingStatus.mock.calls.length;

    act(() => setLocaleForTest?.("it-IT"));

    expect(screen.getByLabelText("Nome visualizzato")).toBe(input);
    expect(input).toHaveValue("Mario Focus Draft");
    expect(input).toHaveFocus();
    expect(apiMocks.getOnboardingStatus).toHaveBeenCalledTimes(readCount);
    expect(apiMocks.updateAccountProfile).not.toHaveBeenCalled();
  });

  it("submits the profile payload exactly once and never exposes an unknown raw failure", async () => {
    const user = userEvent.setup();
    apiMocks.updateAccountProfile.mockRejectedValueOnce(new Error("RAW_PROVIDER_SENTINEL"));
    renderAccountCenter("en");
    const input = await screen.findByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Mario Payload");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(apiMocks.updateAccountProfile).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({
      display_name: "Mario Payload",
      phone_e164: "+39000000000",
    });
    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Could not save the profile. Try again"),
    );
    expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_PROVIDER_SENTINEL");
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "uses an exact profile body once per same-tick attempt in %s and retains only failed drafts",
    async (locale) => {
      const copy = accountActionCopy[locale];
      apiMocks.updateAccountProfile.mockRejectedValueOnce(new Error("RAW_PROFILE_SENTINEL"));
      renderAccountCenter(locale);
      const input = await screen.findByLabelText(copy.displayName);
      await userEvent.clear(input);
      await userEvent.type(input, "  Mario Profile  ");
      const button = screen.getByRole("button", { name: copy.saveProfile });

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(apiMocks.updateAccountProfile).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({
        display_name: "Mario Profile",
        phone_e164: "+39000000000",
      });
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(copy.profileError));
      expect(input).toHaveValue("  Mario Profile  ");
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_PROFILE_SENTINEL");

      apiMocks.updateAccountProfile.mockClear().mockResolvedValueOnce({
        ...accountStatus("qa@example.test"),
        displayName: "Mario Profile",
        phoneE164: "+39000000000",
      });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(apiMocks.updateAccountProfile).toHaveBeenCalledTimes(1));
      expect(apiMocks.updateAccountProfile).toHaveBeenCalledWith({
        display_name: "Mario Profile",
        phone_e164: "+39000000000",
      });
      await waitFor(() => expect(input).toHaveValue("Mario Profile"));
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "updates the password once per same tick in %s with exact payload and failure draft retention",
    async (locale) => {
      const copy = accountActionCopy[locale];
      renderAccountCenter(locale);
      await screen.findByDisplayValue("QA Owner");
      const current = document.getElementById("current-password") as HTMLInputElement;
      const password = document.getElementById("new-password") as HTMLInputElement;
      const confirmation = document.getElementById("new-password-confirmation") as HTMLInputElement;
      fireEvent.change(current, { target: { value: "current-secret" } });
      fireEvent.change(password, { target: { value: "next-secret" } });
      fireEvent.change(confirmation, { target: { value: "next-secret" } });
      const button = screen.getByRole("button", { name: copy.updatePassword });

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledTimes(1));
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        password: "next-secret",
        current_password: "current-secret",
      });
      await waitFor(() => expect(current).toHaveValue(""));
      expect(password).toHaveValue("");
      expect(confirmation).toHaveValue("");

      authMocks.updateUser.mockClear().mockResolvedValueOnce({
        error: { message: "RAW_PASSWORD_SENTINEL" },
      });
      fireEvent.change(current, { target: { value: "retry-current" } });
      fireEvent.change(password, { target: { value: "retry-password" } });
      fireEvent.change(confirmation, { target: { value: "retry-password" } });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledTimes(1));
      expect(current).toHaveValue("retry-current");
      expect(password).toHaveValue("retry-password");
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(copy.providerError));
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_PASSWORD_SENTINEL");
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "sends the normalized reset request once per same tick in %s with the exact redirect",
    async (locale) => {
      const copy = accountActionCopy[locale];
      apiMocks.getOnboardingStatus.mockResolvedValue(accountStatus(" QA@Example.TEST "));
      let resolveReset!: (value: { error: null }) => void;
      authMocks.resetPasswordForEmail.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
      );
      const firstRender = renderAccountCenter(locale);
      const button = await screen.findByRole("button", { name: copy.sendReset });
      const redirectTo = `${window.location.origin}/auth/callback?next=%2Freset-password`;
      await waitFor(() => expect(button).not.toBeDisabled());

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1));
      expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("qa@example.test", {
        redirectTo,
      });
      await waitFor(() => expect(button).toBeDisabled());
      await act(async () => {
        resolveReset({ error: null });
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(toastMocks.success).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(button).not.toBeDisabled());
      firstRender.unmount();

      authMocks.resetPasswordForEmail.mockClear().mockResolvedValueOnce({
        error: { message: "RAW_RESET_SENTINEL" },
      });
      renderAccountCenter(locale);
      const failureButton = await screen.findByRole("button", { name: copy.sendReset });
      await waitFor(() => expect(failureButton).not.toBeDisabled());
      fireEvent.click(failureButton);
      fireEvent.click(failureButton);
      await waitFor(() => expect(authMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(copy.providerError));
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_RESET_SENTINEL");
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "resends verification once per same tick in %s with the exact request",
    async (locale) => {
      const copy = accountActionCopy[locale];
      apiMocks.getOnboardingStatus.mockResolvedValue(accountStatus("QA@Example.TEST", false));
      let resolveResend!: (value: { error: null }) => void;
      authMocks.resend.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveResend = resolve;
        }),
      );
      renderAccountCenter(locale);
      const button = await screen.findByRole("button", { name: copy.resendVerification });
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=%2Faccount`;

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.resend).toHaveBeenCalledTimes(1));
      expect(authMocks.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "qa@example.test",
        options: { emailRedirectTo },
      });
      await act(async () => resolveResend({ error: null }));
      await waitFor(() => expect(toastMocks.success).toHaveBeenCalledTimes(1));

      authMocks.resend.mockClear().mockResolvedValueOnce({
        error: { message: "RAW_VERIFY_SENTINEL" },
      });
      fireEvent.click(button);
      fireEvent.click(button);
      await waitFor(() => expect(authMocks.resend).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(copy.providerError));
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_VERIFY_SENTINEL");
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "changes email sequentially once per same tick in %s and clears only a successful draft",
    async (locale) => {
      const copy = accountActionCopy[locale];
      renderAccountCenter(locale);
      await screen.findByDisplayValue("QA Owner");
      const email = document.getElementById("account-new-email") as HTMLInputElement;
      const confirmation = document.getElementById(
        "account-new-email-confirmation",
      ) as HTMLInputElement;
      const password = document.getElementById(
        "account-email-current-password",
      ) as HTMLInputElement;
      fireEvent.change(email, { target: { value: " NEW@Example.TEST " } });
      fireEvent.change(confirmation, { target: { value: "new@example.test" } });
      fireEvent.change(password, { target: { value: "current-secret" } });
      const button = screen.getByRole("button", { name: copy.sendEmailChange });
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=%2Faccount`;

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledTimes(1));
      expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "qa@example.test",
        password: "current-secret",
      });
      expect(authMocks.updateUser).toHaveBeenCalledWith(
        { email: "new@example.test" },
        { emailRedirectTo },
      );
      expect(authMocks.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
        authMocks.updateUser.mock.invocationCallOrder[0],
      );
      await waitFor(() => expect(email).toHaveValue(""));
      expect(confirmation).toHaveValue("");
      expect(password).toHaveValue("");

      authMocks.signInWithPassword.mockClear().mockResolvedValueOnce({
        error: { message: "RAW_EMAIL_SENTINEL" },
      });
      authMocks.updateUser.mockClear();
      fireEvent.change(email, { target: { value: "retry@example.test" } });
      fireEvent.change(confirmation, { target: { value: "retry@example.test" } });
      fireEvent.change(password, { target: { value: "retry-secret" } });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1));
      expect(authMocks.updateUser).not.toHaveBeenCalled();
      expect(email).toHaveValue("retry@example.test");
      expect(confirmation).toHaveValue("retry@example.test");
      expect(password).toHaveValue("retry-secret");
      await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(copy.providerError));
      expect(JSON.stringify(toastMocks.error.mock.calls)).not.toContain("RAW_EMAIL_SENTINEL");
    },
  );
});
