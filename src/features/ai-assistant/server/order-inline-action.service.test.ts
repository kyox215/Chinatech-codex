import { describe, expect, it, vi } from "vitest";

import type { AuditActor, OrderDetail, OrderListItem } from "@/lib/repairdesk/types";
import { runAiOrderInlineAction } from "./order-inline-action.service";

const enabledEnv = {
  AI_ASSISTANT_ENABLED: "1",
  AI_ORDER_READ_TOOLS_ENABLED: "1",
  AI_ORDER_INLINE_ACTIONS_ENABLED: "1",
  AI_ASSISTANT_STORE_ALLOWLIST: "store-1",
} as const;

const input = {
  order_id: "order-1",
  action: "mark_parts_ordered" as const,
  confirm_public_no: "R2026001",
  expected_updated_at: "2026-07-19T10:00:00.000Z",
  idempotency_key: "00000000-0000-4000-8000-000000000701",
};

describe("AI order inline action", () => {
  it("fails closed while the independent write flag is off", async () => {
    const transitionOrder = vi.fn();
    await expect(
      runAiOrderInlineAction({
        actor: owner,
        input,
        dependencies: {
          getOrder: vi.fn(),
          transitionOrder,
          env: { ...enabledEnv, AI_ORDER_INLINE_ACTIONS_ENABLED: "0" },
        },
      }),
    ).rejects.toMatchObject({ code: "AI_DISABLED", status: 404 });
    expect(transitionOrder).not.toHaveBeenCalled();
  });

  it("rechecks the order and forwards the exact version and idempotency key to the atomic transition", async () => {
    const before = detail(order({ parts_status: "needed" }));
    const after = detail(
      order({
        status: "parts_ordered",
        workflow_status: "parts",
        parts_status: "ordered",
        updated_at: "2026-07-19T10:01:00.000Z",
      }),
    );
    const getOrder = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const transitionOrder = vi.fn(async () => ({ ok: true }));

    const result = await runAiOrderInlineAction({
      actor: owner,
      input,
      dependencies: { getOrder, transitionOrder, env: enabledEnv },
    });

    expect(transitionOrder).toHaveBeenCalledWith("order-1", "parts_ordered", {
      reason: "ai_inline_action_confirmed",
      expectedUpdatedAt: input.expected_updated_at,
      idempotencyKey: input.idempotency_key,
      operator: owner,
    });
    expect(result).toMatchObject({
      ok: true,
      action: "mark_parts_ordered",
      card: { parts_status: "ordered", allowed_actions: [] },
    });
  });

  it("rejects stale or mismatched confirmation before any write", async () => {
    for (const staleInput of [
      { ...input, confirm_public_no: "R-WRONG" },
      { ...input, expected_updated_at: "2026-07-19T09:59:00.000Z" },
    ]) {
      const transitionOrder = vi.fn();
      await expect(
        runAiOrderInlineAction({
          actor: owner,
          input: staleInput,
          dependencies: {
            getOrder: vi.fn(async () => detail(order({ parts_status: "needed" }))),
            transitionOrder,
            env: enabledEnv,
          },
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(transitionOrder).not.toHaveBeenCalled();
    }
  });

  it("keeps non-owner roles blocked even when the flag is enabled", async () => {
    const transitionOrder = vi.fn();
    await expect(
      runAiOrderInlineAction({
        actor: { ...owner, role: "manager", storeRole: "manager" },
        input,
        dependencies: { getOrder: vi.fn(), transitionOrder, env: enabledEnv },
      }),
    ).rejects.toMatchObject({ code: "AI_DISABLED" });
    expect(transitionOrder).not.toHaveBeenCalled();
  });
});

const owner: AuditActor = {
  id: "staff-owner",
  displayName: "Owner",
  role: "owner",
  storeRole: "owner",
  storeId: "store-1",
  activeMembershipId: "membership-owner",
};

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    public_no: "R2026001",
    status: "quoted",
    workflow_status: "quote",
    order_type: "quick_repair",
    payment_status: "unpaid",
    approval_status: "approved",
    customer_id: "customer-1",
    device_id: "device-1",
    customer_name: "M*** R***",
    customer_phone: "***4567",
    device_label: "Apple iPhone 13",
    device_imei: "",
    issue_description: "",
    quotation_amount: 0,
    deposit_amount: 0,
    balance_amount: 0,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "Owner",
    contact_phones: [],
    fault_prices: [],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-19T09:00:00.000Z",
    updated_at: "2026-07-19T10:00:00.000Z",
    device_custody_status: "with_shop",
    ...overrides,
  };
}

function detail(value: OrderListItem): OrderDetail {
  return {
    order: value,
    events: [],
    messages: [],
    attachments: [],
    capabilities: { canTransition: true } as OrderDetail["capabilities"],
  };
}
