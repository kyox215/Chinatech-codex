import { describe, expect, it } from "vitest";

import type {
  InventoryLifecycleCommand,
  InventoryLifecycleCommandResult,
} from "@/lib/repairdesk/types";

import { resolveInventoryOperationReceipt } from "./inventory-operation-receipt";

function result(
  commandCode: string,
  extra: Partial<InventoryLifecycleCommandResult> = {},
): InventoryLifecycleCommandResult {
  return {
    ok: true,
    code: commandCode,
    sale_order_id: "sale-private-id",
    payment_id: "payment-private-id",
    balance: 123.45,
    ...extra,
  };
}

describe("resolveInventoryOperationReceipt", () => {
  it("uses the command for fresh success copy and drops result fields", () => {
    const receipt = resolveInventoryOperationReceipt(
      "payment.append",
      result("appended", { code: "appended" }),
    );

    expect(receipt).toMatchObject({
      command: "payment.append",
      kind: "confirmed",
      replayed: false,
      title: "付款记录已确认追加",
    });
    expect(JSON.stringify(receipt)).not.toContain("sale-private-id");
    expect(JSON.stringify(receipt)).not.toContain("payment-private-id");
    expect(JSON.stringify(receipt)).not.toContain("123.45");
  });

  it("keeps an idempotent replay distinct without implying another write", () => {
    const receipt = resolveInventoryOperationReceipt("sale.complete", result("idempotent_replay"));

    expect(receipt).toMatchObject({ kind: "idempotent-replay", replayed: true });
    expect(JSON.stringify(receipt)).not.toContain("重复写入");
    expect(receipt?.description).toContain("最新读回");
  });

  it("fails closed for non-success results and uses generic copy for unknown runtime values", () => {
    expect(
      resolveInventoryOperationReceipt("inspection.save", result("saved", { ok: false })),
    ).toBeNull();

    const unknown = resolveInventoryOperationReceipt(
      "unknown.command" as InventoryLifecycleCommand,
      result("future_success"),
    );
    expect(unknown).toMatchObject({ title: "写入已确认", kind: "confirmed" });
    expect(unknown?.ledgerSemantics).not.toContain("金额");
  });
});
