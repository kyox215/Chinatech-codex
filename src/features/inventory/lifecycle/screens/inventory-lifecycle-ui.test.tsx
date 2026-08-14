import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getInventoryProduct: vi.fn(),
  searchCustomers: vi.fn(),
  readInventoryLifecycleAfterSalesCase: vi.fn(),
  readInventoryLifecycleSale: vi.fn(),
  readInventoryLifecycleSummary: vi.fn(),
  runInventoryLifecycleCommand: vi.fn(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getInventoryProduct: apiMocks.getInventoryProduct,
  searchCustomers: apiMocks.searchCustomers,
  readInventoryLifecycleAfterSalesCase: apiMocks.readInventoryLifecycleAfterSalesCase,
  readInventoryLifecycleSale: apiMocks.readInventoryLifecycleSale,
  readInventoryLifecycleSummary: apiMocks.readInventoryLifecycleSummary,
  runInventoryLifecycleCommand: apiMocks.runInventoryLifecycleCommand,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => routerMocks,
}));

import { InventoryLifecycleReservationScreen } from "./inventory-lifecycle-reservation-screen";
import { InventoryLifecycleSaleScreen } from "./inventory-lifecycle-sale-screen";
import { InventoryLifecycleReadonlyScreen } from "./inventory-lifecycle-readonly-screen";
import { InventoryLifecycleAfterSalesCaseScreen } from "./inventory-lifecycle-after-sales-screen";
import { InventoryDeviceHealthCard } from "../components/inventory-lifecycle-status";
import { InventoryInspectionEditor } from "../forms/inventory-inspection-editor";
import { InventoryReservationForm } from "../forms/inventory-reservation-form";
import { inventoryLifecycleKeys } from "../api/query-keys";

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = shellContext();
  apiMocks.getInventoryProduct.mockResolvedValue(productFixture);
  apiMocks.readInventoryLifecycleSummary.mockResolvedValue(summaryFixture);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("inventory lifecycle UI safety gates", () => {
  it("shows an unavailable state and does not request product data without permission", () => {
    shellMocks.value = shellContext({ canReadInventory: false });
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(screen.getByRole("heading", { name: "当前账号没有访问权限" })).toBeVisible();
    expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled();
  });

  it("keeps reservation submission disabled until server actions are projected", async () => {
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(await screen.findByText(/服务端尚未返回可用动作/)).toBeVisible();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("validates payment amount before calling payment.append", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["payment.append"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.clear(await screen.findByRole("textbox", { name: /本次收款/ }));
    await user.click(await screen.findByRole("button", { name: /确认追加/ }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /本次收款/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    const amount = screen.getByRole("textbox", { name: /本次收款/ });
    amount.focus();
    expect(amount).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /确认追加/ }));
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("validates pickup exception reason and clears the summary after correction", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["pickup.confirm"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "确认已取走并开始保修" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();

    await user.type(screen.getByRole("textbox", { name: /余额未清例外原因/ }), "客户确认延期");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("validates warranty months and reason before warranty.adjust", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["warranty.adjust"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "保存新的商业保修版本" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /新商业保修/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /调整原因/ })).toBeRequired();
  });

  it("validates after-sales intake issue before after_sales.create", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue({
      ...saleFixture,
      allowed_actions: ["after_sales.create"],
    });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByRole("button", { name: "建立售后案件" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("does not open cancel confirmation when the required reason is missing", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("focuses the after-sales diagnosis summary instead of mutating an empty diagnosis", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      diagnosis: "",
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    await user.click(await screen.findByRole("button", { name: "保存并追加历史" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("textbox", { name: /检测与处理说明/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("explains missing after-sales transition facts without changing allowed actions", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      allowed_actions: ["after_sales.update"],
      allowed_next_statuses: [],
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("heading", { name: "资料需要人工核对" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "保存并追加历史" })).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("focuses inspection validation and does not save an invalid battery value", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    const battery = screen.getByRole("spinbutton");
    await user.type(battery, "101");
    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(battery).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a structured inspection receipt without exposing result fields", async () => {
    const user = userEvent.setup();
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({
      ok: true,
      code: "saved",
      stock_unit_id: "unit-private-id",
      version: 8,
    });
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(await screen.findByText("检测写入已确认")).toBeVisible();
    expect(screen.queryByText("unit-private-id")).not.toBeInTheDocument();
    expect(
      document.querySelector<HTMLElement>("[data-ui='inventory-operation-receipt-panel']"),
    ).toHaveTextContent("最新读回");
  });

  it.each([
    ["stale_version", "资料版本已变化"],
    ["future_conflict_code", "操作发生冲突"],
  ] as const)(
    "keeps inspection %s conflicts read-only until readback succeeds",
    async (code, title) => {
      const user = userEvent.setup();
      const verifyConflict = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      apiMocks.runInventoryLifecycleCommand
        .mockRejectedValueOnce(
          Object.assign(new Error("raw conflict details"), { status: 409, code }),
        )
        .mockResolvedValueOnce({ ok: true, code: "saved" });
      renderWithQuery(
        <InventoryInspectionEditor
          summary={{
            ...summaryFixture,
            allowed_actions: ["inspection.save"],
            unit_version: 2,
            inspection: {
              battery_health: null,
              face_id_status: "not_tested",
              touch_id_status: "not_tested",
              true_tone_status: "not_tested",
              activation_lock_status: "not_tested",
              data_wipe_status: "not_tested",
              imei_status: "not_tested",
              inspected_at: "2026-08-01T08:00:00.000Z",
            },
          }}
          brand="Apple"
          category="phone"
          onVerifyConflict={verifyConflict}
        />,
      );

      await user.click(screen.getByRole("button", { name: "保存检测版本" }));
      expect(await screen.findByText(title)).toBeVisible();
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
      expect(screen.queryByText("raw conflict details")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
      expect(verifyConflict).toHaveBeenCalledTimes(1);
      expect(screen.getByText("刷新失败，当前内容没有自动提交；请稍后再次刷新。")).toBeVisible();
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
      await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument());
      expect(verifyConflict).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "保存检测版本" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "保存检测版本" }));
      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
      const calls = apiMocks.runInventoryLifecycleCommand.mock.calls;
      expect(calls[0]?.[0]?.idempotency_key).toEqual(expect.any(String));
      expect(calls[1]?.[0]?.idempotency_key).toEqual(expect.any(String));
      expect(calls[1]?.[0]?.idempotency_key).not.toBe(calls[0]?.[0]?.idempotency_key);
    },
  );

  it("separates inspection commit from readback and never unlocks after a failed sync", async () => {
    const user = userEvent.setup();
    const syncReadback = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({ ok: true, code: "saved" });
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
        onSyncCommitted={syncReadback}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    expect(await screen.findByText("检测写入已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() =>
      expect(document.querySelector("[data-ui='inventory-sync-status-panel']")).toHaveAttribute(
        "data-sync-status",
        "recovered",
      ),
    );
    expect(syncReadback).toHaveBeenCalledTimes(2);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeEnabled();
  });

  it("redacts an inspection outcome-unknown error and blocks a duplicate write", async () => {
    const user = userEvent.setup();
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      new Error("private inspection raw"),
    );
    renderWithQuery(
      <InventoryInspectionEditor
        summary={{
          ...summaryFixture,
          allowed_actions: ["inspection.save"],
          unit_version: 2,
          inspection: {
            battery_health: null,
            face_id_status: "not_tested",
            touch_id_status: "not_tested",
            true_tone_status: "not_tested",
            activation_lock_status: "not_tested",
            data_wipe_status: "not_tested",
            imei_status: "not_tested",
            inspected_at: "2026-08-01T08:00:00.000Z",
          },
        }}
        brand="Apple"
        category="phone"
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存检测版本" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(screen.queryByText("private inspection raw")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存检测版本" })).toBeDisabled();
  });

  it("focuses the reservation feedback after a server save error", async () => {
    const user = userEvent.setup();
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(new Error("写入失败"));
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
      />,
    );

    const customerSearch = screen.getByRole("textbox", { name: /客户/ });
    await user.type(customerSearch, "合成");
    await user.click(await screen.findByRole("button", { name: /合成客户/ }));
    await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "现场确认无需定金");
    await user.click(screen.getByRole("button", { name: "确认预订" }));

    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("暂时无法确认写入结果");
    expect(screen.queryByText("写入失败")).not.toBeInTheDocument();
  });

  it("rotates the reservation idempotency key only after readback and never auto-replays", async () => {
    const user = userEvent.setup();
    const verify = vi.fn().mockResolvedValue(undefined);
    apiMocks.searchCustomers.mockResolvedValue([
      { id: "customer-1", name: "合成客户", phone_e164: "+390000000000" },
    ]);
    apiMocks.runInventoryLifecycleCommand
      .mockRejectedValueOnce(
        Object.assign(new Error("raw conflict detail"), {
          status: 409,
          code: "idempotency_conflict",
        }),
      )
      .mockResolvedValueOnce({ ok: true, code: "created" });
    renderWithQuery(
      <InventoryReservationForm
        summary={{
          ...summaryFixture,
          allowed_actions: ["reservation.create"],
          unit_version: 2,
        }}
        storeId="store-1"
        defaultPrice={799}
        onSuccess={vi.fn()}
        onVerify={verify}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: /客户/ }), "合成");
    await user.click(await screen.findByRole("button", { name: /合成客户/ }));
    await user.type(screen.getByRole("textbox", { name: /免定金原因/ }), "现场确认无需定金");
    await user.click(screen.getByRole("button", { name: "确认预订" }));
    expect(await screen.findByText("保存标识需要更新")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("raw conflict detail")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.queryByText("保存标识需要更新")).not.toBeInTheDocument());
    expect(verify).toHaveBeenCalledTimes(1);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "确认预订" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(2));
    const calls = apiMocks.runInventoryLifecycleCommand.mock.calls;
    expect(calls[0]?.[0]?.idempotency_key).toEqual(expect.any(String));
    expect(calls[1]?.[0]?.idempotency_key).toEqual(expect.any(String));
    expect(calls[1]?.[0]?.idempotency_key).not.toBe(calls[0]?.[0]?.idempotency_key);
  });

  it("renders independent read-only sales and after-sales routes without inventing data", () => {
    render(<InventoryLifecycleReadonlyScreen kind="sale" recordId="sale-1" />);

    expect(screen.getByRole("heading", { name: "销售详情" })).toBeVisible();
    expect(screen.getByText(/尚未提供销售订单详情/)).toBeVisible();
    expect(screen.getByText("写入保护")).toBeVisible();
  });

  it("shows an explicit untested state instead of converting an absent battery value to zero", () => {
    render(
      <InventoryDeviceHealthCard
        category="phone"
        brand="Apple"
        specifications={{ face_id_status: "normal" }}
      />,
    );

    expect(screen.getByText("电池健康")).toBeVisible();
    expect(screen.getAllByText("尚未检测").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shows only the server-owned close transition after an item is returned", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      case_id: "case-1",
      sale_order_id: "sale-1",
      inventory_item_id: "item-1",
      stock_unit_id: "unit-1",
      sku: "I000001",
      status: "returned",
      issue_summary: "屏幕检测完成，设备已返还",
      received_at: "2026-08-01T08:00:00.000Z",
      returned_at: "2026-08-02T08:00:00.000Z",
      version: 3,
      order_version: 2,
      allowed_actions: ["after_sales.close"],
      allowed_next_statuses: ["closed"],
      diagnosis: "已完成检测并返还设备",
      events: [],
    });
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({ ok: true, code: "closed" });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("button", { name: "确认关闭案件" })).toBeVisible();
    const statusSelect = screen.getAllByRole("combobox")[0];
    expect(statusSelect).toHaveValue("closed");
    expect(statusSelect.querySelectorAll("option")).toHaveLength(1);
    expect(screen.queryByText("处理中")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    const closeButton = screen.getByRole("button", { name: "确认关闭案件" });
    await user.click(closeButton);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(closeButton);
    await user.click(screen.getByRole("button", { name: "确认关闭案件" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledWith(
      {
        command: "after_sales.close",
        idempotency_key: expect.any(String),
        payload: {
          case_id: "case-1",
          expected_case_version: 3,
          status: "closed",
          diagnosis: "已完成检测并返还设备",
          coverage_decision: "pending",
        },
      },
      expect.anything(),
    );
  });

  it("renders after-sales history as a server event ledger with neutral unknown labels", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue({
      ...afterSalesFixture,
      events: [
        {
          event_type: "created",
          occurred_at: "2026-08-01T08:00:00.000Z",
        },
        {
          event_type: "private_internal_type",
          from_status: "open",
          to_status: "waiting_customer",
          occurred_at: "2026-08-02T08:00:00.000Z",
        },
      ],
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    expect(await screen.findByRole("heading", { name: "案件历史（服务端事件账）" })).toBeVisible();
    expect(screen.getByText("业务事件")).toBeVisible();
    expect(screen.getByText("待检测 → 等客户")).toBeVisible();
  });

  it("requires a consequence confirmation before reservation.cancel", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "cancelled" });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    const reason = screen.getByRole("textbox");
    await user.type(reason, "客户改变取货安排");
    await user.selectOptions(screen.getByRole("combobox"), "refund_pending");

    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeVisible());
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledWith(
      {
        command: "reservation.cancel",
        idempotency_key: expect.any(String),
        payload: {
          sale_order_id: "sale-1",
          expected_order_version: 7,
          expected_unit_version: 4,
          disposition: "refund_pending",
          reason: "客户改变取货安排",
        },
      },
      expect.anything(),
    );
  });

  it("shows a structured sale conflict and reloads without replaying the command", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("localized conflict text"), {
        status: 409,
        code: "stale_version",
      }),
    );
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(await screen.findByText("资料版本已变化")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    const readCount = apiMocks.readInventoryLifecycleSale.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() =>
      expect(apiMocks.readInventoryLifecycleSale.mock.calls.length).toBeGreaterThan(readCount),
    );
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("没有自动重放");
  });

  it("keeps an unknown sale outcome read-only until a latest-state check succeeds", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(new Error("private raw failure"));
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));

    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(screen.queryByText("private raw failure")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    const readCount = apiMocks.readInventoryLifecycleSale.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(apiMocks.readInventoryLifecycleSale.mock.calls.length).toBeGreaterThan(readCount),
    );
    expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("re-locks sale writes after an acknowledged timeout is followed by a read error", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("timeout sentinel"), { name: "RepairDeskRequestTimeoutError" }),
    );
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible(),
    );
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();

    apiMocks.readInventoryLifecycleSale.mockRejectedValueOnce(new Error("readback timeout"));
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.sale("sale-1", "store-1"),
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("reloads after an after-sales conflict and clearly warns that local notes are replaced", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("当前状态不能推进"), {
        status: 409,
        code: "invalid_state",
      }),
    );
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(await screen.findByText("当前状态不允许此操作")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("按服务端最新值重载"));
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves a dirty after-sales diagnosis until an explicit latest-load recovery", async () => {
    const user = userEvent.setup();
    const serverChanged = {
      ...afterSalesFixture,
      version: 4,
      diagnosis: "服务端最新说明",
    };
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockResolvedValue(serverChanged);
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const diagnosis = await screen.findByRole("textbox", { name: /检测与处理说明/ });
    await user.clear(diagnosis);
    await user.type(diagnosis, "本地未保存说明");
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.afterSalesCase("case-1", "store-1"),
    });

    expect(await screen.findByText("服务端案件已变化")).toBeVisible();
    expect(diagnosis).toHaveValue("本地未保存说明");
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "刷新最新状态" }));
    await waitFor(() => expect(screen.queryByText("服务端案件已变化")).not.toBeInTheDocument());
    expect(diagnosis).toHaveValue("服务端最新说明");
    expect(screen.getByRole("button", { name: "保存并追加历史" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
  });

  it("re-locks after-sales writes after an acknowledged timeout is followed by a read error", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
      Object.assign(new Error("timeout sentinel"), { name: "RepairDeskRequestTimeoutError" }),
    );
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(await screen.findByText("暂时无法确认写入结果")).toBeVisible();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /读取最新状态（不会写入）/ }));
    await waitFor(() =>
      expect(screen.getByText(/已读取最新状态；没有自动重放刚才的写入/)).toBeVisible(),
    );
    await user.click(screen.getByRole("button", { name: "我已核对最新状态" }));
    expect(screen.getByRole("button", { name: "保存并追加历史" })).toBeEnabled();

    apiMocks.readInventoryLifecycleAfterSalesCase.mockRejectedValueOnce(
      new Error("readback timeout"),
    );
    await view.queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.afterSalesCase("case-1", "store-1"),
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed sale safe when post-commit reads fail and retry never mutates", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale
      .mockResolvedValueOnce(saleFixture)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(saleFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "cancelled" });
    renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);

    await user.click(await screen.findByText("更多管理操作"));
    await user.type(screen.getByRole("textbox"), "客户改变取货安排");
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));
    await user.click(screen.getByRole("button", { name: "确认取消预订" }));

    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("预订取消已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.queryByText("操作失败，请刷新后重试。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.getByText(/当前页面已恢复可用/)).toBeVisible());
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("keeps a committed after-sales update out of the mutation error path", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(afterSalesFixture);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "updated" });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("售后更新已确认")).toBeVisible();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.queryByText("保存失败，请刷新后重试。")).not.toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.getByText(/当前页面已恢复可用/)).toBeVisible());
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("treats the committed after-sales v3 to v4 readback as self-commit, not a dirty conflict", async () => {
    const user = userEvent.setup();
    const committedReadback = {
      ...afterSalesFixture,
      version: 4,
      diagnosis: "服务端确认的新说明",
    };
    apiMocks.readInventoryLifecycleAfterSalesCase
      .mockResolvedValueOnce(afterSalesFixture)
      .mockResolvedValueOnce(committedReadback)
      .mockResolvedValueOnce(committedReadback);
    apiMocks.runInventoryLifecycleCommand.mockResolvedValueOnce({
      ok: true,
      code: "updated",
      case_version: 4,
    });
    renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);

    const save = await screen.findByRole("button", { name: "保存并追加历史" });
    await user.click(save);
    await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("售后更新已确认")).toBeVisible();
    await waitFor(() =>
      expect(document.querySelector("[data-ui='inventory-sync-status-panel']")).toHaveAttribute(
        "data-sync-status",
        "recovered",
      ),
    );
    expect(screen.queryByText("服务端案件已变化")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /检测与处理说明/ })).toHaveValue(
      "服务端确认的新说明",
    );
    expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
  });

  it("does not render a previous sale snapshot after the store key changes", async () => {
    apiMocks.readInventoryLifecycleSale
      .mockResolvedValueOnce(saleFixture)
      .mockRejectedValue(new Error("store read unavailable"));
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    expect(await screen.findByText(/STORY-SALE-001/)).toBeVisible();

    shellMocks.value = {
      ...shellContext(),
      activeStore: { id: "store-2" },
      authorityFingerprint: "store-2:owner",
    };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <InventoryLifecycleSaleScreen saleOrderId="sale-1" />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "暂时无法读取生命周期资料" })).toBeVisible(),
    );
    expect(screen.queryByText("STORY-SALE-001")).not.toBeInTheDocument();
  });

  it("keeps cached sale data read-only when a background read fails, then unlocks after readback", async () => {
    const user = userEvent.setup();
    apiMocks.readInventoryLifecycleSale.mockResolvedValueOnce(saleFixture);
    const view = renderWithQuery(<InventoryLifecycleSaleScreen saleOrderId="sale-1" />);
    expect(await screen.findByText(/STORY-SALE-001/)).toBeVisible();

    apiMocks.readInventoryLifecycleSale.mockRejectedValueOnce(new Error("synthetic read failure"));
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "sale"],
    });

    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();

    apiMocks.readInventoryLifecycleSale.mockResolvedValueOnce(saleFixture);
    await user.click(screen.getByRole("button", { name: /只读刷新最新状态/ }));
    await waitFor(() => expect(screen.getByText("最新状态已读取")).toBeVisible());
    expect(screen.getByRole("button", { name: "确认取消预订" })).toBeEnabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("locks a cached reservation summary after a read error without mutating", async () => {
    apiMocks.readInventoryLifecycleSummary.mockResolvedValueOnce({
      ...summaryFixture,
      allowed_actions: ["reservation.create"],
    });
    const view = renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);
    expect(await screen.findByRole("button", { name: "确认预订" })).toBeVisible();

    apiMocks.readInventoryLifecycleSummary.mockRejectedValueOnce(
      new Error("synthetic read failure"),
    );
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "summary"],
    });
    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("keeps a cached after-sales case visible but read-only after a failed refresh", async () => {
    apiMocks.readInventoryLifecycleAfterSalesCase.mockResolvedValueOnce(afterSalesFixture);
    const view = renderWithQuery(<InventoryLifecycleAfterSalesCaseScreen caseId="case-1" />);
    expect(await screen.findByRole("button", { name: "保存并追加历史" })).toBeVisible();

    apiMocks.readInventoryLifecycleAfterSalesCase.mockRejectedValueOnce(
      new Error("synthetic read failure"),
    );
    await view.queryClient.refetchQueries({
      queryKey: ["inventory-lifecycle", "after-sales-case"],
    });
    expect(await screen.findByText("资料需要只读刷新")).toBeVisible();
    expect(screen.getByRole("button", { name: "当前不可写入" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });
});

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>),
    queryClient,
  };
}

function shellContext(overrides: Record<string, boolean> = {}) {
  return {
    isLoading: false,
    activeStore: { id: "store-1" },
    authorityFingerprint: "store-1:owner",
    permissions: {
      canReadInventory: true,
      inventoryProductsUiEnabled: true,
      inventoryLifecycleUiEnabled: true,
      ...overrides,
    },
  };
}

const productFixture = {
  id: "item-1",
  sku: "I000001",
  category: "phone" as const,
  brand: "Apple",
  model: "iPhone 15 Pro",
  status: "in_stock" as const,
  currency_code: "EUR" as const,
  updated_at: "2026-08-01T08:00:00.000Z",
  list_price: 899,
  version: 2,
  identifiers: [],
  specifications: {},
};

const summaryFixture = {
  item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "I000001",
  business_status: "in_stock" as const,
  unit_version: 2,
  allowed_actions: [],
};

const saleFixture = {
  item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "STORY-SALE-001",
  business_status: "reserved" as const,
  unit_version: 4,
  order_version: 7,
  sale_order_id: "sale-1",
  inventory_item_id: "item-1",
  status: "reserved" as const,
  agreed_price: 799,
  signed_paid_amount: 100,
  balance: 699,
  payments: [],
  allowed_actions: ["reservation.cancel"] as const,
};

const afterSalesFixture = {
  case_id: "case-1",
  sale_order_id: "sale-1",
  inventory_item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "STORY-SALE-001",
  status: "in_progress" as const,
  issue_summary: "合成售后案件",
  received_at: "2026-08-01T08:00:00.000Z",
  version: 3,
  order_version: 7,
  allowed_actions: ["after_sales.update"] as const,
  allowed_next_statuses: ["waiting_customer"] as const,
  diagnosis: "合成检测说明",
  coverage_decision: "pending" as const,
  events: [],
};
