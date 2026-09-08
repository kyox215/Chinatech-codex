import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { NewOrderQuotationSection } from "./new-order-quotation-section";

function ScreenQuoteHarness() {
  const [form, setForm] = useState<NewOrderFormState>({
    ...initialNewOrderForm,
    faults: [
      {
        key: "display:main",
        line_id: "00000000-0000-4000-8000-000000000411",
        categoryKey: "display",
        categoryLabel: "屏幕",
        catalog_key: "display:main",
        name: "屏幕",
        price: 0,
      },
    ],
  });

  return (
    <NewOrderQuotationSection
      form={form}
      setForm={setForm}
      total={form.faults.reduce((sum, item) => sum + item.price, 0)}
      operatorName="测试账号"
      onPatchFault={(index, patch) =>
        setForm((current) => ({
          ...current,
          faults: current.faults.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        }))
      }
      onAddCustomFault={() => undefined}
      createStatuses={[]}
      surface="dialog"
    />
  );
}

describe("NewOrderQuotationSection", () => {
  it.each(["zh-CN", "it-IT", "en"] as const)(
    "renders a selected catalog name in %s while leaving the form unchanged",
    (locale) => {
      const setForm = vi.fn();
      const onPatchFault = vi.fn();
      const form: NewOrderFormState = {
        ...initialNewOrderForm,
        faults: [
          {
            key: "display:main",
            categoryKey: "display",
            categoryLabel: "屏幕",
            catalog_key: "display:main",
            name: "屏幕",
            note: "客户原始备注",
            price: 80,
          },
          {
            key: "custom:1",
            categoryKey: "custom",
            categoryLabel: "自定义",
            name: "客户自定义项目",
            price: 20,
          },
        ],
      };
      render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderQuotationSection
            form={form}
            setForm={setForm}
            total={100}
            operatorName="Synthetic operator"
            onPatchFault={onPatchFault}
            onAddCustomFault={vi.fn()}
            createStatuses={[]}
          />
        </LocaleProvider>,
      );
      const disclosure = document.querySelector('[data-order-quote-disclosure="true"]');
      expect(disclosure).toHaveTextContent(locale === "zh-CN" ? "屏幕" : "Display");
      expect(screen.getByText("客户自定义项目")).toBeVisible();
      expect(form.faults[0]).toMatchObject({
        catalog_key: "display:main",
        name: "屏幕",
        note: "客户原始备注",
        price: 80,
      });
      expect(setForm).not.toHaveBeenCalled();
      expect(onPatchFault).not.toHaveBeenCalled();
      cleanup();
    },
  );

  it.each(["mouse", "touch"] as const)(
    "finishes the screen amount without selecting back cover using %s input",
    async (pointerType) => {
      const previousWidth = window.innerWidth;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const click = (target: HTMLElement) =>
        pointerType === "touch" ? user.pointer([{ target, keys: "[TouchA]" }]) : user.click(target);

      try {
        render(
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent>
              {/* JSDOM does not load the Tailwind pointer-events utility. */}
              <style>{".pointer-events-auto { pointer-events: auto; }"}</style>
              <DialogTitle>报价</DialogTitle>
              <DialogDescription>编辑屏幕报价</DialogDescription>
              <ScreenQuoteHarness />
            </DialogContent>
          </Dialog>,
        );

        const backCover = screen.getByRole("button", { name: "后盖" });
        expect(backCover).toHaveAttribute("aria-pressed", "false");
        const amount = screen.getByRole("button", { name: "报价项目 1 金额" });
        await click(amount);
        await click(screen.getByRole("button", { name: "1" }));
        await click(screen.getByRole("button", { name: "0" }));
        await click(screen.getByRole("button", { name: "0" }));
        await click(screen.getByRole("button", { name: "完成" }));

        expect(amount).toHaveTextContent("100");
        expect(backCover).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByRole("button", { name: "报价项目 2 金额" })).not.toBeInTheDocument();
        expect(document.querySelector('[data-virtual-keyboard-dock="true"]')).toBeNull();
        expect(onOpenChange).not.toHaveBeenCalled();

        fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
      } finally {
        cleanup();
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: previousWidth,
        });
      }
    },
  );

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
    fireEvent.click(screen.getByRole("button", { name: "自定义项目" }));
    const custom = screen.getByRole("textbox", { name: "自定义项目" });
    fireEvent.change(custom, { target: { value: "保养项目" } });
    expect(onPatchFault).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
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
