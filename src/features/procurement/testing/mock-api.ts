import { randomUUID } from "node:crypto";

import type {
  AllocateOrderPartInput,
  AuditActor,
  CreatePartCatalogItemInput,
  OrderPartAllocation,
  PartCatalogItem,
  PartPurchaseLot,
  PartsProcurementResult,
  ReceivePartLotInput,
  ReleaseOrderPartInput,
} from "@/lib/repairdesk/types";

const itemId = "00000000-0000-4000-8000-000000000301";
const lotId = "00000000-0000-4000-8000-000000000302";
const items: PartCatalogItem[] = [
  {
    id: itemId,
    sku: "SCREEN-IP15-DEMO",
    name: "iPhone 15 OLED 屏幕",
    catalog_key: "display:main",
    compatible_models: ["iPhone 15"],
    active: true,
    weighted_average_unit_cost_eur: 15,
    available_quantity: 8,
    created_at: "2026-07-18T09:00:00.000Z",
    updated_at: "2026-07-18T09:00:00.000Z",
  },
];
const lots: PartPurchaseLot[] = [
  {
    id: lotId,
    part_item_id: itemId,
    part_sku: "SCREEN-IP15-DEMO",
    part_name: "iPhone 15 OLED 屏幕",
    catalog_key: "display:main",
    supplier_id: "00000000-0000-4000-8000-000000000401",
    supplier_name: "UTOPYA",
    lot_code: "UTOPYA-2026-0718",
    supplier_document_ref: "DEMO-0718",
    received_quantity: 10,
    available_quantity: 8,
    original_unit_cost: 15,
    original_currency_code: "EUR",
    fx_rate_to_eur: 1,
    fx_rate_at: "2026-07-18T09:00:00.000Z",
    fx_rate_source: "store_base",
    unit_cost_eur: 15,
    evidence_status: "confirmed",
    received_at: "2026-07-18T09:00:00.000Z",
  },
];
const allocations: OrderPartAllocation[] = [];

function assertStore(actor: AuditActor, expected?: string) {
  if (actor.isSystem) return expected ?? "00000000-0000-4000-8000-000000000001";
  if (!actor.storeId || (expected && actor.storeId !== expected))
    throw new Error("店铺上下文已变化");
}

export async function getMockPartsProcurement(orderId: string | undefined, actor: AuditActor) {
  assertStore(actor);
  return {
    items: [...items],
    lots: [...lots],
    suppliers: [{ id: "00000000-0000-4000-8000-000000000401", name: "UTOPYA" }],
    allocations: allocations.filter((item) => !orderId || item.order_id === orderId),
  } satisfies PartsProcurementResult;
}

export async function createMockPartCatalogItem(
  input: CreatePartCatalogItemInput,
  actor: AuditActor,
) {
  assertStore(actor, input.expected_store_id);
  const id = randomUUID();
  items.push({
    id,
    sku: input.sku,
    name: input.name,
    catalog_key: input.catalog_key,
    compatible_models: input.compatible_models,
    active: true,
    weighted_average_unit_cost_eur: null,
    available_quantity: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { id, replayed: false };
}

export async function receiveMockPartLot(input: ReceivePartLotInput, actor: AuditActor) {
  assertStore(actor, input.expected_store_id);
  const part = items.find((item) => item.id === input.part_item_id);
  if (!part) throw new Error("配件不存在");
  const id = randomUUID();
  const unitCostEur = input.original_unit_cost * input.fx_rate_to_eur;
  lots.push({
    id,
    part_item_id: part.id,
    part_sku: part.sku,
    part_name: part.name,
    catalog_key: part.catalog_key,
    supplier_id: input.supplier_id,
    supplier_name: input.supplier_id ? "UTOPYA" : undefined,
    lot_code: input.lot_code,
    supplier_document_ref: input.supplier_document_ref,
    received_quantity: input.quantity,
    available_quantity: input.quantity,
    original_unit_cost: input.original_unit_cost,
    original_currency_code: input.original_currency_code,
    fx_rate_to_eur: input.fx_rate_to_eur,
    fx_rate_at: input.fx_rate_at,
    fx_rate_source: input.fx_rate_source,
    unit_cost_eur: unitCostEur,
    evidence_status: "confirmed",
    received_at: new Date().toISOString(),
  });
  part.available_quantity += input.quantity;
  return { id, replayed: false };
}

export async function allocateMockOrderPart(
  orderId: string,
  input: AllocateOrderPartInput,
  actor: AuditActor,
) {
  assertStore(actor, input.expected_store_id);
  const lot = lots.find((item) => item.id === input.lot_id);
  if (!lot || lot.available_quantity < input.quantity) throw new Error("采购批次数量不足");
  const id = randomUUID();
  lot.available_quantity -= input.quantity;
  allocations.push({
    id,
    order_id: orderId,
    line_id: input.line_id,
    lot_id: lot.id,
    part_item_id: lot.part_item_id,
    supplier_id: lot.supplier_id,
    quantity: input.quantity,
    part_sku: lot.part_sku,
    part_name: lot.part_name,
    supplier_name: lot.supplier_name,
    unit_cost_eur: lot.unit_cost_eur,
    total_cost_eur: lot.unit_cost_eur * input.quantity,
    state: "allocated",
    allocated_at: new Date().toISOString(),
  });
  return { id, cost_amount: lot.unit_cost_eur * input.quantity, replayed: false };
}

export async function releaseMockOrderPart(input: ReleaseOrderPartInput, actor: AuditActor) {
  assertStore(actor, input.expected_store_id);
  const allocation = allocations.find((item) => item.id === input.allocation_id);
  if (!allocation) throw new Error("分配记录不存在");
  allocation.state = "released";
  allocation.released_at = new Date().toISOString();
  allocation.release_reason = input.reason;
  const lot = lots.find((item) => item.id === allocation.lot_id);
  if (lot) lot.available_quantity += allocation.quantity;
  return { id: allocation.id, replayed: false };
}
