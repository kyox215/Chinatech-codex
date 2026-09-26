import type {
  InventorySalesWorkflowReadResult,
  InventorySalesWorkflowReport,
} from "../model/workflow-contracts";
import { syntheticSalesDetail } from "./sales-ui.fixture";

export function syntheticSalesWorkflow(): InventorySalesWorkflowReadResult {
  return {
    workflow: {
      sale_order_id: syntheticSalesDetail().order!.id,
      version: 0,
      fiscal: null,
      followup: {
        assignee_membership_id: null,
        assignee_name: null,
        follow_up_at: null,
        note: null,
      },
      issues: [],
    },
    history: [],
    truncated: { issues: false, history: false },
    assignees: [
      {
        membership_id: "80000000-0000-4000-8000-000000000001",
        display_name: "Synthetic Operator",
        role: "owner",
      },
    ],
    capabilities: { can_edit: true, can_verify: true, can_report_finance: true },
  };
}

export function syntheticSalesDailyReport(): InventorySalesWorkflowReport {
  const detail = syntheticSalesDetail();
  return {
    business_date: "2026-09-26",
    timezone: "Europe/Rome",
    generated_at: "2026-09-26T10:00:00Z",
    finance: {
      agreed_sale_count: 1,
      agreed_sales_cents: 10000,
      collected_payment_count: 1,
      collected_cents: 3000,
      collected_by_method: { cash: 3000, card: 0, bancomat: 0, transfer: 0, other: 0 },
      ledger_mismatch_count: 0,
      ledger_difference_cents: 0,
    },
    pending: {
      scope: "store",
      awaiting_payment_count: 1,
      paid_pending_pickup_count: 0,
      missing_fiscal_count: 1,
      unverified_fiscal_count: 0,
      open_issue_count: 0,
      overdue_followup_count: 0,
      rows: [
        {
          sale_order_id: detail.order!.id,
          inventory_item_id: detail.inventory_item_id,
          sale_number: detail.order!.sale_number,
          status: "awaiting_payment",
          follow_up_at: null,
          assignee_name: null,
          missing_fiscal: true,
          unverified_fiscal: false,
          open_issue_count: 0,
        },
      ],
      total: 1,
      offset: 0,
      limit: 30,
    },
  };
}
