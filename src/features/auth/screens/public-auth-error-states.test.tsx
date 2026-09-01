import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordScreen } from "@/features/auth/screens/forgot-password-screen";
import { LoginScreen } from "@/features/auth/screens/login-screen";
import { ResetPasswordScreen } from "@/features/auth/screens/reset-password-screen";

const authMocks = vi.hoisted(() => ({
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
}));
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks,
  useSearchParams: () => navigationMocks.searchParams,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("public auth inline error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMocks.searchParams = new URLSearchParams();
    authMocks.resend.mockResolvedValue({ error: null });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
  });

  it("keeps login input and associates a provider credential error with both fields", async () => {
    const user = userEvent.setup();
    authMocks.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<LoginScreen />);

    const email = screen.getByLabelText("邮箱");
    const password = screen.getByLabelText("密码");
    await user.type(email, "staff@example.com");
    await user.type(password, "secret-password");
    await user.click(screen.getByRole("button", { name: /^登录$/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("邮箱或密码不正确");
    expect(alert).not.toHaveTextContent("Invalid login credentials");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(email).toHaveValue("staff@example.com");
    expect(password).toHaveValue("secret-password");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "auth-form-error");
    expect(password).toHaveAttribute("aria-describedby", "auth-form-error");
  });

  it("keeps the reset email while replacing an unknown provider detail with a safe alert", async () => {
    const user = userEvent.setup();
    authMocks.resetPasswordForEmail.mockResolvedValue({
      error: { message: "SERVER_SECRET_STACK" },
    });
    render(<ForgotPasswordScreen />);

    const email = screen.getByLabelText("邮箱");
    await user.type(email, "staff@example.com");
    await user.click(screen.getByRole("button", { name: "发送重置邮件" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("操作失败，请稍后再试");
    expect(alert).not.toHaveTextContent("SERVER_SECRET_STACK");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(email).toHaveValue("staff@example.com");
  });

  it("keeps password input and associates a provider weak-password error with both fields", async () => {
    const user = userEvent.setup();
    authMocks.updateUser.mockResolvedValue({ error: { message: "Weak password" } });
    render(<ResetPasswordScreen />);

    const password = screen.getByLabelText("新密码", { exact: true });
    const confirmation = screen.getByLabelText("确认新密码");
    await user.type(password, "valid-password");
    await user.type(confirmation, "valid-password");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("密码强度不够");
    expect(alert).not.toHaveTextContent("Weak password");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(password).toHaveValue("valid-password");
    expect(confirmation).toHaveValue("valid-password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(confirmation).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-describedby", "reset-password-error");
    expect(confirmation).toHaveAttribute("aria-describedby", "reset-password-error");
  });
});
