import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STORE_RULE_DEFAULTS } from "@/entities/store/model/store-setting-defaults";
import { RulesSettingsSection } from "@/features/settings/sections/rules-settings-section";

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
    expect(screen.getByRole("status")).toHaveTextContent("仍需点击“保存”才会生效");
  });

  it("uses semantic read-only values and renders no disabled form controls", () => {
    const { container } = renderRules({
      draft: {
        default_order_warranty_months: 0,
        default_inventory_warranty_months: 0,
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
});

function renderRules({
  draft = {
    default_order_warranty_months: 12 as const,
    default_inventory_warranty_months: 18,
  },
  canUpdateSettings = true,
  canManageOrderCosts = false,
  activeStoreId,
  onDraftChange = vi.fn(),
}: {
  draft?: {
    default_order_warranty_months: 0 | 3 | 6 | 12 | 24;
    default_inventory_warranty_months: number;
  };
  canUpdateSettings?: boolean;
  canManageOrderCosts?: boolean;
  activeStoreId?: string;
  onDraftChange?: (patch: {
    default_order_warranty_months?: 0 | 3 | 6 | 12 | 24;
    default_inventory_warranty_months?: number;
  }) => void;
} = {}) {
  return render(
    <RulesSettingsSection
      draft={draft}
      isDraftDirty
      canUpdateSettings={canUpdateSettings}
      activeStoreId={activeStoreId}
      canManageOrderCosts={canManageOrderCosts}
      fieldErrors={{}}
      onDraftChange={onDraftChange}
    />,
  );
}
