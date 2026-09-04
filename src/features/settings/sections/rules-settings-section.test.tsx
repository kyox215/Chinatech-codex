import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STORE_RULE_DEFAULTS } from "@/entities/store/model/store-setting-defaults";
import { RulesSettingsSection } from "@/features/settings/sections/rules-settings-section";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

vi.mock("@/features/settings/components/repair-cost-defaults-card", () => ({
  RepairCostDefaultsCard: ({ storeId }: { storeId: string }) => (
    <div data-testid="settings-test-defaults-card" data-store-id={storeId}>
      <label>
        测试成本草稿
        <input aria-label="测试成本草稿" defaultValue="初始成本" />
      </label>
      <div data-testid="settings-test-cost-guard" />
    </div>
  ),
}));

vi.mock("@/features/settings/components/cost-currency-settings-card", () => ({
  CostCurrencySettingsCard: ({ storeId }: { storeId: string }) => (
    <div data-testid="settings-test-currency-card" data-store-id={storeId} />
  ),
}));

vi.mock("@/features/settings/components/parts-procurement-card", () => ({
  PartsProcurementCard: ({
    storeId,
    multiCurrencyEnabled,
  }: {
    storeId: string;
    multiCurrencyEnabled: boolean;
  }) => (
    <div
      data-testid="settings-test-parts-card"
      data-store-id={storeId}
      data-multi-currency={String(multiCurrencyEnabled)}
    />
  ),
}));

vi.mock("@/features/settings/components/cost-backfill-card", () => ({
  CostBackfillCard: ({ storeId, canApply }: { storeId: string; canApply: boolean }) => (
    <div
      data-testid="settings-test-backfill-card"
      data-store-id={storeId}
      data-can-apply={String(canApply)}
    />
  ),
}));

afterEach(cleanup);

describe("RulesSettingsSection", () => {
  it("explains new-object-only semantics and edits the section draft", () => {
    const onDraftChange = vi.fn();
    renderRules({ onDraftChange });

    expect(screen.getByText("只影响之后新建的业务对象")).toBeVisible();
    expect(screen.getByText(/已有维修单、库存记录及已售保修快照不会被改写/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("新库存商品默认保修月数"), {
      target: { value: "0" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({ default_inventory_warranty_months: 0 });
    expect(screen.getByText("0 表示新库存默认无保修；允许范围 0–120 个月。")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /简易模式/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ new_order_entry_mode: "simple" });

    fireEvent.change(screen.getByLabelText("新库存商品默认保修月数"), {
      target: { value: "" },
    });
    expect(screen.getByText("请输入库存默认保修月数")).toBeVisible();
    expect(onDraftChange).toHaveBeenLastCalledWith({
      default_inventory_warranty_months: Number.NaN,
    });
  });

  it("previews restore defaults and only applies them to the draft after confirmation", () => {
    const onDraftChange = vi.fn();
    renderRules({
      draft: {
        default_order_warranty_months: 24,
        default_inventory_warranty_months: 36,
        new_order_entry_mode: "simple",
      },
      onDraftChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "恢复系统默认" }));
    const dialog = screen.getByRole("alertdialog", { name: "把系统默认值应用到草稿？" });
    expect(dialog).toHaveTextContent("两年");
    expect(dialog).toHaveTextContent("36 个月");
    expect(onDraftChange).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "应用默认值到草稿" }));
    expect(onDraftChange).toHaveBeenCalledWith({ ...STORE_RULE_DEFAULTS });
    expect(screen.getByText(/仍需点击“保存”才会生效/)).toBeVisible();
  });

  it("uses semantic read-only values and renders no disabled form controls", () => {
    const { container } = renderRules({
      draft: {
        default_order_warranty_months: 0,
        default_inventory_warranty_months: 0,
        new_order_entry_mode: "professional",
      },
      canUpdateSettings: false,
    });

    expect(container.querySelector("dl")).not.toBeNull();
    expect(screen.getAllByText(/无保修/)).toHaveLength(2);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复系统默认" })).not.toBeInTheDocument();
  });

  it("keeps an already-default restore trigger focusable but semantically unavailable", () => {
    renderRules({ draft: { ...STORE_RULE_DEFAULTS } });
    const restore = screen.getByRole("button", { name: "恢复系统默认" });

    expect(restore).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(restore);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("当前草稿已是系统默认。")).toBeVisible();
  });

  it("describes an invalid empty draft without leaking NaN copy", () => {
    renderRules({
      draft: {
        default_order_warranty_months: 24,
        default_inventory_warranty_months: Number.NaN,
        new_order_entry_mode: "simple",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "恢复系统默认" }));
    const dialog = screen.getByRole("alertdialog", { name: "把系统默认值应用到草稿？" });
    expect(dialog).toHaveTextContent("未填写");
    expect(dialog).not.toHaveTextContent("NaN");
  });

  it("does not mount or name internal cost controls without the dedicated permission", () => {
    renderRules({ canManageOrderCosts: false, activeStoreId: "store-a" });

    expect(screen.queryByLabelText("维修项目默认成本")).not.toBeInTheDocument();
    expect(screen.queryByText("成本仅供获授权管理人员查看")).not.toBeInTheDocument();
    expect(screen.queryByText("配件采购成本与库存")).not.toBeInTheDocument();
    expect(screen.queryByText("采购成本币种与汇率")).not.toBeInTheDocument();
  });

  it("keeps cost editors and their unsaved guard mounted while the fold is closed", () => {
    renderRules({ canManageOrderCosts: true, activeStoreId: "store-a" });

    const toggle = screen.getByRole("button", { name: /^财务与成本/ });
    const content = document.querySelector<HTMLElement>("[data-settings-rules-costs-content]");
    expect(content).not.toBeNull();
    expect(content).toHaveAttribute("hidden", "");
    expect(
      document.querySelector("[data-testid='settings-test-defaults-card']"),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-testid='settings-test-cost-guard']")).toBeInTheDocument();

    fireEvent.click(toggle);
    const input = screen.getByRole("textbox", { name: "测试成本草稿" });
    fireEvent.change(input, { target: { value: "编辑后的成本" } });
    expect(input).toHaveValue("编辑后的成本");

    fireEvent.click(toggle);
    expect(content).toHaveAttribute("hidden", "");
    expect(document.querySelector("[data-testid='settings-test-cost-guard']")).toBeInTheDocument();
    expect(
      document.querySelector<HTMLInputElement>("[data-testid='settings-test-defaults-card'] input"),
    ).toHaveValue("编辑后的成本");
    expect(screen.queryByRole("textbox", { name: "测试成本草稿" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("textbox", { name: "测试成本草稿" })).toHaveValue("编辑后的成本");
  });

  it.each([
    ["zh-CN", "默认规则", "新库存商品默认保修月数", "简易模式"],
    [
      "it-IT",
      "Regole predefinite",
      "Mesi di garanzia predefiniti per nuovo inventario",
      "Modalità guidata",
    ],
    ["en", "Default rules", "Default warranty months for new inventory", "Guided mode"],
  ] as const)(
    "localizes fixed presentation while preserving canonical draft values in %s",
    (locale, heading, inventoryLabel, simpleLabel) => {
      const onDraftChange = vi.fn();
      renderRules({ locale, onDraftChange });

      expect(screen.getByText(heading)).toBeVisible();
      fireEvent.change(screen.getByLabelText(inventoryLabel), { target: { value: "36" } });
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(simpleLabel) }));
      expect(onDraftChange).toHaveBeenNthCalledWith(1, {
        default_inventory_warranty_months: 36,
      });
      expect(onDraftChange).toHaveBeenNthCalledWith(2, { new_order_entry_mode: "simple" });
    },
  );

  it.each([
    ["defaults", { canManageOrderCosts: true }, "settings-test-defaults-card"],
    ["currency", { canManageCostCurrencies: true }, "settings-test-currency-card"],
    ["parts", { canAllocatePartsCosts: true }, "settings-test-parts-card"],
    ["backfill", { canPreviewCostBackfill: true }, "settings-test-backfill-card"],
  ] as const)("mounts only the independently authorized %s child", (_name, capability, testId) => {
    renderRules({ activeStoreId: "store-a", ...capability });

    expect(screen.getByTestId(testId)).toHaveAttribute("data-store-id", "store-a");
    for (const candidate of [
      "settings-test-defaults-card",
      "settings-test-currency-card",
      "settings-test-parts-card",
      "settings-test-backfill-card",
    ]) {
      if (candidate !== testId) expect(screen.queryByTestId(candidate)).not.toBeInTheDocument();
    }
  });

  it("passes stable child capabilities without granting hidden sibling reads", () => {
    renderRules({
      activeStoreId: "store-a",
      canAllocatePartsCosts: true,
      canReadCostCurrencies: true,
      canPreviewCostBackfill: true,
      canApplyCostBackfill: false,
    });

    expect(screen.getByTestId("settings-test-parts-card")).toHaveAttribute(
      "data-multi-currency",
      "true",
    );
    expect(screen.getByTestId("settings-test-backfill-card")).toHaveAttribute(
      "data-can-apply",
      "false",
    );
    expect(screen.queryByTestId("settings-test-currency-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-test-defaults-card")).not.toBeInTheDocument();
  });
});

function renderRules({
  draft = {
    default_order_warranty_months: 12 as const,
    default_inventory_warranty_months: 18,
    new_order_entry_mode: "professional" as const,
  },
  canUpdateSettings = true,
  canManageOrderCosts = false,
  canAllocatePartsCosts = false,
  canReadCostCurrencies = false,
  canManageCostCurrencies = false,
  canPreviewCostBackfill = false,
  canApplyCostBackfill = false,
  activeStoreId,
  onDraftChange = vi.fn(),
  locale = "zh-CN",
}: {
  draft?: {
    default_order_warranty_months: 0 | 3 | 6 | 12 | 24;
    default_inventory_warranty_months: number;
    new_order_entry_mode: "simple" | "professional";
  };
  canUpdateSettings?: boolean;
  canManageOrderCosts?: boolean;
  canAllocatePartsCosts?: boolean;
  canReadCostCurrencies?: boolean;
  canManageCostCurrencies?: boolean;
  canPreviewCostBackfill?: boolean;
  canApplyCostBackfill?: boolean;
  activeStoreId?: string;
  onDraftChange?: (patch: {
    default_order_warranty_months?: 0 | 3 | 6 | 12 | 24;
    default_inventory_warranty_months?: number;
    new_order_entry_mode?: "simple" | "professional";
  }) => void;
  locale?: AppLocale;
} = {}) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <RulesSettingsSection
        draft={draft}
        isDraftDirty
        canUpdateSettings={canUpdateSettings}
        activeStoreId={activeStoreId}
        canManageOrderCosts={canManageOrderCosts}
        canAllocatePartsCosts={canAllocatePartsCosts}
        canReadCostCurrencies={canReadCostCurrencies}
        canManageCostCurrencies={canManageCostCurrencies}
        canPreviewCostBackfill={canPreviewCostBackfill}
        canApplyCostBackfill={canApplyCostBackfill}
        fieldErrors={{}}
        onDraftChange={onDraftChange}
      />
    </LocaleProvider>,
  );
}
