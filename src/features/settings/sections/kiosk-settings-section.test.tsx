import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatKioskDateTime,
  KioskSettingsSection,
} from "@/features/settings/sections/kiosk-settings-section";
import type { KioskDevice, KioskSession } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

afterEach(cleanup);

const device: KioskDevice = {
  id: "device-1",
  store_id: "store-a",
  label: "前台 iPad",
  status: "active",
  paired_at: "2026-07-13T00:00:00.000Z",
  last_seen_at: "2026-07-13T00:05:00.000Z",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:05:00.000Z",
};

const session: KioskSession = {
  id: "session-1",
  store_id: "store-a",
  device_id: device.id,
  order_id: "order-1",
  customer_id: "customer-1",
  session_type: "order_contact_signature",
  status: "submitted",
  request_payload: { order_public_no: "TEST-001", device_label: "iPhone Test" },
  submission_payload: {
    customer_name: "Cliente Test Molto Lungo",
    customer_phone: "+39 333 000 0000",
    note: "Nota completa visibile senza troncamento",
    confirmation_checked: true,
    has_signature: true,
  },
  submission_version: 2,
  expires_at: "2099-07-13T00:00:00.000Z",
  submitted_at: "2026-07-13T00:10:00.000Z",
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:10:00.000Z",
  device,
};

describe("KioskSettingsSection", () => {
  it("keeps device and review query states independent", () => {
    renderKiosk({ devicesError: true, sessions: [session] });

    expect(screen.getByText("设备读取失败")).toBeVisible();
    expect(screen.getByText("Cliente Test Molto Lungo")).toBeVisible();
    expect(screen.queryByText("审核任务读取失败")).not.toBeInTheDocument();
  });

  it("shows the pairing target and expiry context with touch-safe actions", () => {
    renderKiosk({
      pairing: {
        code: "12345678",
        expiresAt: "2099-07-13T00:15:00.000Z",
        deviceLabel: "柜台二号 iPad",
        storeName: "Test Store",
      },
    });

    expect(screen.getByText("12345678")).toBeVisible();
    expect(screen.getByText("柜台二号 iPad")).toBeVisible();
    expect(screen.getAllByText("Test Store").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /复制/ })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: /生成配对码/ })).toHaveClass("min-h-11");
  });

  it("locks accept confirmation to one request and restores trigger focus", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((nextResolve) => {
      resolve = nextResolve;
    });
    const onAcceptSession = vi.fn().mockReturnValue(pending);
    renderKiosk({ sessions: [session], onAcceptSession });

    const trigger = screen.getByRole("button", { name: "接受并更新" });
    fireEvent.click(trigger);
    const confirm = screen.getByRole("button", { name: "确认提交" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onAcceptSession).toHaveBeenCalledTimes(1);
    expect(onAcceptSession).toHaveBeenCalledWith(session);
    expect(screen.getByRole("button", { name: "正在处理" })).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the return reason and focuses the inline error after failure", async () => {
    const onReturnSession = vi.fn().mockRejectedValue(new Error("任务已被其他员工处理"));
    renderKiosk({ sessions: [session], onReturnSession });

    fireEvent.change(screen.getByLabelText("给客户的退回原因"), {
      target: { value: "请重新确认电话号码" },
    });
    const trigger = screen.getByRole("button", { name: "退回重填" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("操作失败，请重试");
    expect(error).not.toHaveTextContent("任务已被其他员工处理");
    await waitFor(() => expect(error).toHaveFocus());
    expect(screen.getByLabelText("给客户的退回原因")).toHaveValue("请重新确认电话号码");
    expect(onReturnSession).toHaveBeenCalledWith(session, "请重新确认电话号码");
  });

  it.each([
    ["zh-CN" as const, "客户 iPad", "生成配对码"],
    ["it-IT" as const, "iPad cliente", "Genera codice di associazione"],
    ["en" as const, "Customer iPad", "Generate pairing code"],
  ])(
    "localizes fixed staff controls in %s while preserving the default pairing label",
    async (locale, title, action) => {
      const onCreatePairing = vi.fn().mockResolvedValue(undefined);
      renderKiosk({ onCreatePairing }, locale);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: action }));
      await waitFor(() => expect(onCreatePairing).toHaveBeenCalledWith("前台 iPad"));
      await waitFor(() => expect(screen.getByRole("button", { name: action })).toBeEnabled());
    },
  );

  it("locks pairing and revoke before awaiting and tears down scoped UI on permission loss", async () => {
    let resolvePairing!: () => void;
    const pairing = new Promise<void>((resolve) => {
      resolvePairing = resolve;
    });
    const onCreatePairing = vi.fn().mockReturnValue(pairing);
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    const view = renderKiosk({ onCreatePairing, onRevoke }, "en");
    const pair = screen.getByRole("button", { name: "Generate pairing code" });
    fireEvent.click(pair);
    fireEvent.click(pair);
    expect(onCreatePairing).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePairing();
      await pairing;
    });
    await waitFor(() => expect(pair).toBeEnabled());

    const revoke = screen.getByRole("button", { name: "Revoke device" });
    fireEvent.click(revoke);
    const confirm = screen.getByRole("button", { name: "Confirm revoke" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(onRevoke).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirm revoke" })).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke device" }));
    expect(screen.getByRole("button", { name: "Confirm revoke" })).toBeVisible();
    view.rerender(kioskTree({ canManageDevices: false }, "en"));
    expect(screen.queryByRole("button", { name: "Revoke device" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm revoke" })).not.toBeInTheDocument();
  });

  it("formats kiosk dates in Rome and never echoes an invalid timestamp", () => {
    const hostTimezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    const instant = "2026-10-25T01:30:00.000Z";
    try {
      expect(formatKioskDateTime(instant, "zh-CN")).toBe("10/25 02:30");
      expect(formatKioskDateTime(instant, "it-IT")).toBe("25/10, 02:30");
      expect(formatKioskDateTime(instant, "en")).toBe("10/25, 02:30 AM");
      expect(formatKioskDateTime("RAW_INVALID_TIMESTAMP", "zh-CN")).toBe("时间不可用");
      expect(formatKioskDateTime("RAW_INVALID_TIMESTAMP", "it-IT")).toBe("Data non disponibile");
      expect(formatKioskDateTime("RAW_INVALID_TIMESTAMP", "en")).toBe("Date unavailable");
    } finally {
      if (hostTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = hostTimezone;
    }
  });
});

function kioskTree(
  overrides: Partial<React.ComponentProps<typeof KioskSettingsSection>> = {},
  locale: AppLocale = "zh-CN",
) {
  return (
    <LocaleProvider initialLocale={locale}>
      <KioskHarness overrides={overrides} />
    </LocaleProvider>
  );
}

function KioskHarness({
  overrides,
}: {
  overrides: Partial<React.ComponentProps<typeof KioskSettingsSection>>;
}) {
  const [returnReasons, setReturnReasons] = useState(overrides.returnReasons ?? {});
  const props: React.ComponentProps<typeof KioskSettingsSection> = {
    storeName: "Test Store",
    devices: [device],
    sessions: [],
    canManageDevices: true,
    canReviewSessions: true,
    devicesLoading: false,
    devicesError: false,
    sessionsLoading: false,
    sessionsError: false,
    returnReasons,
    onRetryDevices: vi.fn(),
    onRetrySessions: vi.fn(),
    onReturnReasonChange: (currentSession, value) =>
      setReturnReasons((current) => ({
        ...current,
        [`${currentSession.id}:${currentSession.submission_version}`]: value,
      })),
    onReturnReasonConsumed: (currentSession) =>
      setReturnReasons((current) => {
        const next = { ...current };
        delete next[`${currentSession.id}:${currentSession.submission_version}`];
        return next;
      }),
    onCreatePairing: vi.fn().mockResolvedValue(undefined),
    onRevoke: vi.fn().mockResolvedValue(undefined),
    onAcceptSession: vi.fn().mockResolvedValue(undefined),
    onReturnSession: vi.fn().mockResolvedValue(undefined),
    onCopyCode: vi.fn(),
    ...overrides,
  };
  return <KioskSettingsSection {...props} />;
}

function renderKiosk(
  overrides: Partial<React.ComponentProps<typeof KioskSettingsSection>> = {},
  locale: AppLocale = "zh-CN",
) {
  return render(kioskTree(overrides, locale));
}
