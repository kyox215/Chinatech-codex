import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { OrderWorkflowStatus } from "@/lib/repairdesk/api";

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
});
