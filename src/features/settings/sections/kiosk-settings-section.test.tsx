import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KioskSettingsSection } from "@/features/settings/sections/kiosk-settings-section";
import type { KioskDevice, KioskSession } from "@/lib/repairdesk/types";

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
    expect(error).toHaveTextContent("任务已被其他员工处理");
    await waitFor(() => expect(error).toHaveFocus());
    expect(screen.getByLabelText("给客户的退回原因")).toHaveValue("请重新确认电话号码");
    expect(onReturnSession).toHaveBeenCalledWith("session-1", "请重新确认电话号码");
  });
});

function renderKiosk(overrides: Partial<React.ComponentProps<typeof KioskSettingsSection>> = {}) {
  function Harness() {
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

  return render(<Harness />);
}
