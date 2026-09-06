import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/api";

import { NewOrderQuotationSection } from "./new-order-quotation-section";

describe("NewOrderQuotationSection", () => {
  it("keeps catalog names static and custom names editable beside native quote amounts", () => {
    const onPatchFault = vi.fn();
    const setForm = vi.fn();
    const form = {
      ...initialNewOrderForm,
      faults: [
        {
          key: "display:original",
          categoryKey: "display",
          categoryLabel: "屏幕",
          name: "屏幕 - 原装",
          note: "Ricambio originale",
          price: 85,
        },
        {
          key: "custom:1",
          categoryKey: "custom",
          categoryLabel: "自定义",
          name: "清洁保养",
          note: "",
          price: 15,
        },
      ],
    };
    render(
      <NewOrderQuotationSection
        form={form}
        setForm={setForm}
        total={100}
        operatorName="示例操作员"
        onPatchFault={onPatchFault}
        onAddCustomFault={vi.fn()}
        createStatuses={[]}
      />,
    );
    expect(screen.getByText("屏幕 - 原装")).toBeVisible();
    expect(screen.queryByDisplayValue("屏幕 - 原装")).not.toBeInTheDocument();
    const custom = screen.getByRole("textbox", { name: "自定义项目" });
    fireEvent.change(custom, { target: { value: "保养项目" } });
    expect(onPatchFault).toHaveBeenCalledWith(1, { name: "保养项目" });
    expect(screen.getByRole("textbox", { name: "报价项目 1 金额" })).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    fireEvent.click(screen.getAllByRole("button", { name: "删除报价项目" })[1]!);
    expect(setForm).toHaveBeenCalledWith({ ...form, faults: [form.faults[0]] });
  });

  it("keeps one editable deposit control inside the quote draft", () => {
    const { container } = render(
      <NewOrderQuotationSection
        form={{ ...initialNewOrderForm, deposit: 20 }}
        setForm={vi.fn()}
        total={100}
        operatorName="测试账号"
        onPatchFault={vi.fn()}
        onAddCustomFault={vi.fn()}
        createStatuses={
          [
            {
              code: "new",
              label: "新建",
              short_label: "新建",
              tone: "info",
              bucket: "intake",
              enabled: true,
              show_in_order_filters: true,
              allowed_for_create: true,
              is_default_create_status: true,
              sort_order: 0,
            },
          ] as OrderWorkflowStatus[]
        }
      />,
    );

    const quoteDraft = container.querySelector('[data-new-order-quote-draft="true"]');
    expect(quoteDraft).not.toBeNull();
    expect(quoteDraft?.querySelectorAll('[data-new-order-field="deposit"]')).toHaveLength(1);
    expect(screen.getAllByRole("textbox", { name: "定金" })).toHaveLength(1);
    expect(screen.queryByText("报价暂停")).not.toBeInTheDocument();
    expect(screen.queryByText("定金与服务")).not.toBeInTheDocument();
  });

  it("keeps order settings in the collapsible service settings while accessories belong to the device", () => {
    const { container } = render(
      <NewOrderQuotationSection
        form={initialNewOrderForm}
        setForm={vi.fn()}
        total={0}
        operatorName="很长的录入人员姓名"
        operatorRole="owner"
        onPatchFault={vi.fn()}
        onAddCustomFault={vi.fn()}
        createStatuses={
          [
            {
              code: "new",
              label: "新建",
              short_label: "新建",
              tone: "info",
              bucket: "intake",
              enabled: true,
              show_in_order_filters: true,
              allowed_for_create: true,
              is_default_create_status: true,
              sort_order: 0,
            },
          ] as OrderWorkflowStatus[]
        }
      />,
    );

    const settings = container.querySelector('[data-new-order-section="settings"]');
    const grid = settings?.querySelector('[data-new-order-settings-grid="true"]');
    expect(settings?.querySelector('[data-new-order-setting="warranty"]')).not.toBeNull();
    expect(grid).toHaveClass("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(grid?.children).toHaveLength(3);
    expect(settings?.querySelector('[data-new-order-setting="operator"]')?.children[1]).toHaveClass(
      "h-[38px]",
      "rounded-lg",
      "border",
    );
    expect(screen.getByText("很长的录入人员姓名")).toHaveClass("truncate");
  });
});
