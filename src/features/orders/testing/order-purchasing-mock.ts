import { randomUUID } from "node:crypto";
import type {
  AuditActor,
  BatchOrderPurchasesInput,
  BatchOrderPurchasesResult,
  OrderPurchaseLine,
  OrderPurchasingBoardResult,
  SaveOrderPurchaseInput,
} from "@/lib/repairdesk/types";
import { listMockSuppliers } from "@/features/suppliers/testing/mock-api";

const lines = new Map<string, OrderPurchaseLine>();

export async function readMockOrderPurchasingBoard(
  input: { expected_store_id: string; order_ids: string[] },
  actor: AuditActor,
): Promise<OrderPurchasingBoardResult> {
  const suppliers = resolveMockOrderPurchaseSuppliers(actor);
  return {
    groups: input.order_ids.map((orderId) => ({
      order_id: orderId,
      lines: [...lines.values()]
        .filter((line) => line.order_id === orderId)
        .map((line) => ({
          ...line,
          supplier_name: resolveSupplierName(suppliers, line.supplier_id),
        })),
    })),
    suppliers,
    permissions: { canManage: true, canAssignSupplier: true },
  };
}

export async function saveMockOrderPurchase(
  input: SaveOrderPurchaseInput,
  actor: AuditActor,
): Promise<{ line: OrderPurchaseLine; replayed: boolean }> {
  const existing = input.id ? lines.get(input.id) : undefined;
  if (input.id && (!existing || existing.revision !== input.expected_revision)) {
    throw new Error("采购明细已被其他操作更新，请刷新后重试");
  }
  const now = new Date().toISOString();
  const line: OrderPurchaseLine = {
    id: input.id ?? randomUUID(),
    order_id: input.order_id,
    line_id: input.line_id ?? null,
    part_name: input.part_name,
    supplier_id: input.supplier_id,
    supplier_name: resolveSupplierName(resolveMockOrderPurchaseSuppliers(actor), input.supplier_id),
    unit_cost_eur: input.unit_cost_eur,
    quantity: input.quantity,
    status: input.status,
    revision: existing ? existing.revision + 1 : 1,
    ordered_at: input.status === "ordered" ? (existing?.ordered_at ?? now) : null,
    arrived_at: null,
    updated_at: now,
  };
  lines.set(line.id, line);
  return { line, replayed: false };
}

export async function batchMockOrderPurchases(
  input: BatchOrderPurchasesInput,
  actor: AuditActor,
): Promise<BatchOrderPurchasesResult> {
  const now = new Date().toISOString();
  const suppliers = resolveMockOrderPurchaseSuppliers(actor);
  return {
    replayed: false,
    results: input.items.map((item) => {
      const current = lines.get(item.id);
      if (!current) return { id: item.id, ok: false, code: "purchase_not_found" };
      if (current.revision !== item.expected_revision) {
        return { id: item.id, ok: false, code: "stale_revision", revision: current.revision };
      }
      if (input.operation === "mark_ordered" && (!current.supplier_id || !current.unit_cost_eur)) {
        return { id: item.id, ok: false, code: "incomplete_order", revision: current.revision };
      }
      const next: OrderPurchaseLine = {
        ...current,
        supplier_id:
          input.operation === "assign_supplier" ? (input.supplier_id ?? null) : current.supplier_id,
        supplier_name:
          input.operation === "assign_supplier"
            ? resolveSupplierName(suppliers, input.supplier_id ?? null)
            : current.supplier_name,
        status:
          input.operation === "mark_arrived"
            ? "arrived"
            : input.operation === "mark_ordered"
              ? "ordered"
              : current.status,
        revision: current.revision + 1,
        ordered_at:
          input.operation === "mark_ordered" ? (current.ordered_at ?? now) : current.ordered_at,
        arrived_at: input.operation === "mark_arrived" ? now : current.arrived_at,
        updated_at: now,
      };
      lines.set(next.id, next);
      return { id: next.id, ok: true, revision: next.revision };
    }),
  };
}

export function resetMockOrderPurchasing() {
  lines.clear();
}

function resolveMockOrderPurchaseSuppliers(actor: AuditActor) {
  const availableSuppliers = listMockSuppliers(actor).filter((supplier) => !supplier.archived_at);
  return availableSuppliers.length
    ? availableSuppliers.map(({ id, name }) => ({ id, name }))
    : [
        { id: "00000000-0000-4000-8000-000000000401", name: "UTOPYA" },
        { id: "00000000-0000-4000-8000-000000000402", name: "MobileSentrix" },
      ];
}

function resolveSupplierName(
  suppliers: Array<{ id: string; name: string }>,
  supplierId: string | null,
) {
  if (!supplierId) return null;
  return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? null;
}
