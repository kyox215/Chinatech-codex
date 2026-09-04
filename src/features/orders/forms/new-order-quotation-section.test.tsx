import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

import { NewOrderQuotationSection } from "./new-order-quotation-section";

describe("NewOrderQuotationSection", () => {
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

  it("keeps order settings in the original compact full-row plus two-by-two structure", () => {
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
    expect(grid?.children).toHaveLength(4);
    expect(settings?.querySelector('[data-new-order-setting="operator"]')?.children[1]).toHaveClass(
      "h-[38px]",
      "rounded-lg",
      "border",
    );
    expect(screen.getByText("很长的录入人员姓名")).toHaveClass("truncate");
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "hides internal cost without permission and makes it localized read-only while defaults load in %s",
    (locale) => {
      const form = {
        ...initialNewOrderForm,
        faults: [
          {
            line_id: "00000000-0000-4000-8000-000000000411",
            key: "display:original",
            categoryKey: "display",
            categoryLabel: "屏幕",
            catalog_key: "display:original",
            name: "原装屏幕",
            note: "动态备注",
            price: 120,
          },
        ],
      };
      const baseProps = {
        form,
        setForm: vi.fn(),
        total: 120,
        operatorName: "Marco Rossi",
        onPatchFault: vi.fn(),
        onAddCustomFault: vi.fn(),
        createStatuses: [
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
        ] as OrderWorkflowStatus[],
      };
      const hidden = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderQuotationSection {...baseProps} canManageOrderCosts={false} />
        </LocaleProvider>,
      );
      expect(
        screen.queryByRole("textbox", {
          name: translateMessage(locale, "orders2b1.new.costAria", { index: 1 }),
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "orders2b1.new.quoteAria", { index: 1 }),
        }),
      ).toBeEnabled();
      hidden.unmount();

      render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderQuotationSection {...baseProps} canManageOrderCosts costDefaultsPending />
        </LocaleProvider>,
      );
      const cost = screen.getByRole("textbox", {
        name: translateMessage(locale, "orders2b1.new.costAria", { index: 1 }),
      });
      expect(cost).toBeDisabled();
      expect(cost).toHaveAttribute(
        "placeholder",
        translateMessage(locale, "orders2b1.new.loading"),
      );
      expect(
        screen.getByRole("textbox", {
          name: translateMessage(locale, "orders2b1.new.quoteAria", { index: 1 }),
        }),
      ).toBeEnabled();
      expect(screen.getByText(translateMessage(locale, "orders2b1.new.quoteTitle"))).toBeVisible();
    },
  );
});
