import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const note = z.string().trim().max(1000);
const common = {
  sale_order_id: uuid,
  expected_workflow_version: version,
  idempotency_key: uuid,
};
export const inventorySalesWorkflowCommandBodySchema = z.discriminatedUnion("command", [
  z
    .object({
      ...common,
      command: z.literal("fiscal.record"),
      payload: z
        .object({
          document_type: z.enum(["receipt", "invoice", "other"]),
          reference: z.string().trim().min(1).max(128),
          issued_at: timestamp,
          correction_reason: z.string().trim().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      command: z.literal("fiscal.verify"),
      payload: z
        .object({
          expected_fiscal_revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
          note: note.optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      command: z.literal("followup.set"),
      payload: z
        .object({
          assignee_membership_id: uuid.nullable(),
          follow_up_at: timestamp.nullable(),
          note: note.optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      command: z.literal("issue.open"),
      payload: z
        .object({
          kind: z.enum([
            "payment_mismatch",
            "fiscal_document",
            "customer_request",
            "delivery",
            "other",
          ]),
          summary: z.string().trim().min(1).max(1000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      command: z.literal("issue.resolve"),
      payload: z
        .object({
          issue_id: uuid,
          resolution: z.string().trim().min(1).max(1000),
        })
        .strict(),
    })
    .strict(),
]);
export const inventorySalesWorkflowReadBodySchema = z.object({ sale_order_id: uuid }).strict();
export const inventorySalesWorkflowReportBodySchema = z
  .object({
    business_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "营业日期无效"),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(100).default(30),
  })
  .strict();
export type InventorySalesWorkflowCommandBody = z.infer<
  typeof inventorySalesWorkflowCommandBodySchema
>;
export type InventorySalesWorkflowReadInput = z.infer<typeof inventorySalesWorkflowReadBodySchema>;
export type InventorySalesWorkflowReportInput = z.infer<
  typeof inventorySalesWorkflowReportBodySchema
>;
export const inventorySalesWorkflowCommandResultSchema = z
  .object({
    ok: z.literal(true),
    code: z.enum(["completed", "idempotent_replay"]),
    sale_order_id: uuid,
    workflow_version: version,
    event_id: uuid,
  })
  .strict();
export type InventorySalesWorkflowCommandResult = z.infer<
  typeof inventorySalesWorkflowCommandResultSchema
>;
const fiscalSchema = z.object({
  revision: z.number().int().positive(),
  document_type: z.enum(["receipt", "invoice", "other"]),
  reference: z.string(),
  issued_at: z.string(),
  recorded_at: z.string(),
  verified_at: z.string().nullable(),
  verified_by_name: z.string().nullable(),
});
const issueSchema = z.object({
  id: uuid,
  kind: z.enum(["payment_mismatch", "fiscal_document", "customer_request", "delivery", "other"]),
  summary: z.string(),
  status: z.enum(["open", "resolved"]),
  opened_at: z.string(),
  resolved_at: z.string().nullable(),
  resolution: z.string().nullable(),
});
export const inventorySalesWorkflowReadResultSchema = z.object({
  workflow: z.object({
    sale_order_id: uuid,
    version,
    fiscal: fiscalSchema.nullable(),
    followup: z.object({
      assignee_membership_id: uuid.nullable(),
      assignee_name: z.string().nullable(),
      follow_up_at: z.string().nullable(),
      note: z.string().nullable(),
    }),
    issues: z.array(issueSchema).max(100),
  }),
  history: z
    .array(
      z.object({
        id: uuid,
        command: z.string(),
        actor_name: z.string(),
        created_at: z.string(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .max(50),
  truncated: z.object({ issues: z.boolean(), history: z.boolean() }),
  assignees: z.array(
    z.object({
      membership_id: uuid,
      display_name: z.string(),
      role: z.enum(["owner", "manager", "sales"]),
    }),
  ),
  capabilities: z.object({
    can_edit: z.boolean(),
    can_verify: z.boolean(),
    can_report_finance: z.boolean(),
  }),
});
export type InventorySalesWorkflowReadResult = z.infer<
  typeof inventorySalesWorkflowReadResultSchema
>;
export type InventorySalesWorkflow = InventorySalesWorkflowReadResult["workflow"];
const count = z.number().int().nonnegative();
const money = z.number().int().safe();
export const inventorySalesWorkflowReportResultSchema = z.object({
  business_date: z.string(),
  timezone: z.literal("Europe/Rome"),
  generated_at: z.string(),
  finance: z
    .object({
      agreed_sale_count: count,
      agreed_sales_cents: money,
      collected_payment_count: count,
      collected_cents: money,
      collected_by_method: z.object({
        cash: money,
        card: money,
        bancomat: money,
        transfer: money,
        other: money,
      }),
      ledger_mismatch_count: count,
      ledger_difference_cents: money,
    })
    .nullable(),
  pending: z.object({
    scope: z.enum(["mine", "store"]),
    awaiting_payment_count: count,
    paid_pending_pickup_count: count,
    missing_fiscal_count: count,
    unverified_fiscal_count: count,
    open_issue_count: count,
    overdue_followup_count: count,
    rows: z.array(
      z.object({
        sale_order_id: uuid,
        inventory_item_id: uuid,
        sale_number: z.string(),
        status: z.enum(["awaiting_payment", "paid_pending_pickup", "delivered"]),
        follow_up_at: z.string().nullable(),
        assignee_name: z.string().nullable(),
        missing_fiscal: z.boolean(),
        unverified_fiscal: z.boolean(),
        open_issue_count: count,
      }),
    ),
    total: count,
    offset: count,
    limit: count,
  }),
});
export type InventorySalesWorkflowReport = z.infer<typeof inventorySalesWorkflowReportResultSchema>;
