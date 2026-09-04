import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import type { OnboardingRequest } from "@/lib/repairdesk/api";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

import { PlatformAdminScreen } from "./platform-admin-screen";

const api = vi.hoisted(() => ({
  listPlatformOnboardingRequests: vi.fn(),
  approveOnboardingRequest: vi.fn(),
  rejectOnboardingRequest: vi.fn(),
}));
vi.mock("@/lib/repairdesk/api", async (original) => ({
  ...(await original<typeof import("@/lib/repairdesk/api")>()),
  ...api,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  api.listPlatformOnboardingRequests.mockResolvedValue([requestFixture()]);
});
afterEach(cleanup);

describe("PlatformAdminScreen localization", () => {
  it.each([
    ["zh-CN" as const, "待处理申请", "平台管理员", "处理"],
    ["it-IT" as const, "Richieste da gestire", "Amministratore piattaforma", "Gestisci"],
    ["en" as const, "Requests to review", "Platform administrator", "Review"],
  ])(
    "localizes fixed queue UI in %s and preserves requester values",
    async (locale, title, admin, action) => {
      renderPlatform(locale);
      expect(await screen.findByText(title)).toBeVisible();
      expect((await screen.findAllByText("Mario 北店")).length).toBeGreaterThan(0);
      expect(screen.getByText(admin)).toBeVisible();
      expect(screen.getAllByRole("button", { name: action }).length).toBeGreaterThan(0);
      expect(screen.getAllByText("mario@example.test").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Siracusa RAW").length).toBeGreaterThan(0);
    },
  );

  it("preserves the selected request and decision draft across locale changes without approving", async () => {
    renderPlatform("zh-CN", true);
    fireEvent.click((await screen.findAllByRole("button", { name: "处理" }))[0]);
    fireEvent.change(screen.getByLabelText("审批备注 / 拒绝原因"), {
      target: { value: "DYNAMIC draft 北店" },
    });
    act(() => setTestLocale("it-IT"));
    expect(screen.getByRole("button", { name: "Chiudi richiesta piattaforma" })).toBeVisible();
    expect(screen.getByLabelText("Nota di approvazione / motivo del rifiuto")).toHaveValue(
      "DYNAMIC draft 北店",
    );
    expect(screen.getAllByText("Mario 北店").length).toBeGreaterThan(0);
    expect(api.approveOnboardingRequest).not.toHaveBeenCalled();
    expect(api.rejectOnboardingRequest).not.toHaveBeenCalled();
  });

  it("localizes empty and error states", async () => {
    api.listPlatformOnboardingRequests.mockResolvedValueOnce([]);
    const empty = renderPlatform("en");
    expect(await screen.findByText("No requests awaiting review")).toBeVisible();
    empty.unmount();
    api.listPlatformOnboardingRequests.mockRejectedValueOnce(new Error("DYNAMIC backend message"));
    renderPlatform("it-IT");
    expect(await screen.findByText("Caricamento coda approvazioni non riuscito")).toBeVisible();
    expect(screen.getByText("DYNAMIC backend message")).toBeVisible();
  });
});

function renderPlatform(locale: "zh-CN" | "it-IT" | "en", switches = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider initialLocale={locale}>
      <QueryClientProvider client={client}>
        <SidebarProvider>
          {switches ? <LocaleCapture /> : null}
          <PlatformAdminScreen />
        </SidebarProvider>
      </QueryClientProvider>
    </LocaleProvider>,
  );
}
let setTestLocale: (locale: "zh-CN" | "it-IT" | "en") => void = () => undefined;

function LocaleCapture() {
  const { setLocale } = useLocale();
  setTestLocale = setLocale;
  return null;
}
function requestFixture(): OnboardingRequest {
  return {
    id: "request-a",
    requester_user_id: "user-a",
    email: "mario@example.test",
    display_name: "Mario 北店",
    request_type: "create_store",
    desired_store_name: "Siracusa RAW",
    target_store_id: undefined,
    target_store_name: undefined,
    target_owner_email: undefined,
    request_note: "DYNAMIC note 北店",
    review_scope: "platform",
    requested_role: "owner",
    status: "pending",
    reviewed_by: undefined,
    reviewed_by_membership_id: undefined,
    reviewed_at: undefined,
    decision_note: undefined,
    resulting_store_id: undefined,
    created_at: "2026-09-03T08:00:00.000Z",
    updated_at: "2026-09-03T08:00:00.000Z",
  };
}
