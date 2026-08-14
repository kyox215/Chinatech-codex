import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  InventoryLifecycleAfterSalesCaseDetail,
  InventoryLifecycleAfterSalesQueueItem,
  InventoryLifecycleSaleDetail,
} from "@/lib/repairdesk/types";

import { InventoryConsequenceDialog } from "../../components/inventory-consequence-dialog";
import {
  InventoryLifecycleSalePaymentPanel,
  type InventoryLifecycleSaleSubmit,
} from "./inventory-lifecycle-sale-panels";
import {
  InventoryAfterSalesCaseEditor,
  InventoryAfterSalesCaseWorkspace,
  InventoryAfterSalesQueueBody,
  InventoryLifecycleSaleWorkspace,
} from "./inventory-lifecycle-workspaces";

const saleForWriteLock: InventoryLifecycleSaleDetail = {
  item_id: "sale-item",
  stock_unit_id: "sale-unit",
  inventory_item_id: "sale-item",
  sku: "SYNTH-SALE",
  business_status: "reserved",
  unit_version: 1,
  order_version: 1,
  sale_order_id: "sale-order",
  status: "reserved",
  agreed_price: 799,
  signed_paid_amount: 100,
  balance: 699,
  payments: [],
  allowed_actions: ["payment.append"],
};

function CloseWorkspaceHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const item: InventoryLifecycleAfterSalesCaseDetail = {
    case_id: "case-close",
    sale_order_id: "order-close",
    inventory_item_id: "item-close",
    stock_unit_id: "unit-close",
    sku: "SYNTH-CASE",
    status: "returned",
    issue_summary: "合成售后案件",
    received_at: "2026-08-11T08:00:00.000Z",
    returned_at: "2026-08-12T08:00:00.000Z",
    version: 2,
    order_version: 3,
    allowed_actions: ["after_sales.close"],
    allowed_next_statuses: ["closed"],
    diagnosis: "已完成检测说明",
    events: [],
  };
  return (
    <InventoryAfterSalesCaseWorkspace
      item={item}
      title="关闭售后案件"
      context="已返还 · after_sales.close"
      onBack={vi.fn()}
      overview={<p>合成案件概览</p>}
      editor={
        <InventoryAfterSalesCaseEditor
          status="closed"
          nextStatuses={["closed"]}
          coverage="pending"
          diagnosis="已完成检测说明"
          writePending={false}
          onStatusChange={vi.fn()}
          onCoverageChange={vi.fn()}
          onDiagnosisChange={vi.fn()}
          onPrimary={() => setOpen(true)}
          primaryLabel="确认关闭案件"
          closeTriggerRef={triggerRef}
        />
      }
      closeDialog={
        <InventoryConsequenceDialog
          open={open}
          title="确认关闭售后案件？"
          description="关闭只会追加状态记录。"
          consequences={["案件不会被删除。"]}
          confirmLabel="确认关闭案件"
          cancelLabel="继续编辑"
          tone="danger"
          pending={false}
          blocked={false}
          returnFocusRef={triggerRef}
          onOpenChange={setOpen}
          onConfirm={() => setOpen(false)}
        />
      }
    />
  );
}

const queueItem: InventoryLifecycleAfterSalesQueueItem = {
  case_id: "story-case",
  sale_order_id: "story-order",
  inventory_item_id: "story-item",
  stock_unit_id: "story-unit",
  sku: "SYNTH-CASE",
  status: "open",
  issue_summary: "合成案件",
  received_at: "2026-08-11T08:00:00.000Z",
  version: 1,
  order_version: 1,
  allowed_actions: ["after_sales.update"],
  allowed_next_statuses: ["in_progress"],
};

describe("Inventory lifecycle workspaces", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps queue actions explicit and local to the adapter callback", () => {
    const onOpen = vi.fn();
    render(<InventoryAfterSalesQueueBody items={[queueItem]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /打开案件/ }));
    expect(onOpen).toHaveBeenCalledWith(queueItem);
    expect(
      document.querySelector('[data-inventory-lifecycle-body="after-sales-queue"]'),
    ).toBeInTheDocument();
  });

  it("shares sale and case body anchors without mounting data adapters", () => {
    const { rerender } = render(
      <InventoryLifecycleSaleWorkspace title="销售" context="合成" onBack={vi.fn()}>
        <button type="button">payment.append</button>
      </InventoryLifecycleSaleWorkspace>,
    );
    expect(screen.getByRole("button", { name: "payment.append" })).toBeInTheDocument();
    expect(document.querySelector('[data-inventory-lifecycle-body="sale"]')).toBeInTheDocument();

    rerender(
      <InventoryAfterSalesCaseWorkspace title="售后" context="合成" onBack={vi.fn()}>
        <p>after_sales.update</p>
      </InventoryAfterSalesCaseWorkspace>,
    );
    expect(screen.getByText("after_sales.update")).toBeInTheDocument();
    expect(
      document.querySelector('[data-inventory-lifecycle-body="after-sales-case"]'),
    ).toBeInTheDocument();
  });

  it("keeps production adapters and bodies on the shared lifecycle surfaces", () => {
    const source = (relativePath: string) =>
      readFileSync(
        resolve(process.cwd(), "src/features/inventory/lifecycle", relativePath),
        "utf8",
      );
    const saleSource = source("screens/inventory-lifecycle-sale-screen.tsx");
    const salePanelsSource = source("components/inventory-lifecycle-sale-panels.tsx");
    const afterSalesSource = source("screens/inventory-lifecycle-after-sales-screen.tsx");

    expect(saleSource).toContain("inventory-lifecycle-sale-panels");
    expect(salePanelsSource).toContain("InventoryLifecycleSaleMoneyOverview");
    expect(salePanelsSource).toContain("InventoryLifecycleSalePaymentPanel");
    expect(salePanelsSource).toContain("InventoryLifecycleSalePickupPanel");
    expect(salePanelsSource).toContain("export function WarrantyPanel");
    expect(salePanelsSource).toContain("export function AfterSalesIntakePanel");
    expect(salePanelsSource).toContain("export function CancelPanel");
    expect(afterSalesSource).toContain("InventoryAfterSalesCaseOverview");
    expect(afterSalesSource).toContain("InventoryAfterSalesCaseEditor");
    expect(
      salePanelsSource.match(/<fieldset disabled=\{pending \|\| writeBlocked\}/g)?.length,
    ).toBe(6);
  });

  it("locks every payment write control while committed sync is blocked", () => {
    const submit: InventoryLifecycleSaleSubmit = vi.fn();
    render(
      <InventoryLifecycleSalePaymentPanel
        sale={saleForWriteLock}
        pending={false}
        writeBlocked
        submit={submit}
      />,
    );
    const fieldset = document.querySelector("fieldset:disabled");
    expect(fieldset).toBeInTheDocument();
    const controls = fieldset?.querySelectorAll("input, select, button");
    expect(controls?.length).toBe(3);
    controls?.forEach((control) => expect(control).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /确认追加/ }));
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps the full-page close trigger safe through Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<CloseWorkspaceHarness />);
    const trigger = screen.getByRole("button", { name: "确认关闭案件" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
