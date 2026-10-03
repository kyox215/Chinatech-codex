import type { TransactionSql } from "postgres";
import type { StaffMember } from "../staff";
import { normalizeCustomerPhone } from "../customers";
import type { BackendSnapshot, OperationReceipt } from "./contracts";
import { loadStateHeader, projectState } from "./state";
import { referenceRetailPhotos } from "./retail-photos";

export async function emptyState(tx: TransactionSql, storeId: string, member: StaffMember): Promise<BackendSnapshot> {
  const header = await loadStateHeader(tx, storeId, member);
  return { storeId, ...header, intakes: [], signatures: [], workflows: {}, procurement: [], retail: [], retailHistory: [], customers: [] };
}

async function repairs(tx: TransactionSql, state: BackendSnapshot, ids: string[], unitId = "") {
  if (!ids.length && !unitId) return;
  const rows = await tx`select data, signatures, workflow from chinatech_v2_private.repair_intakes
    where store_id=${state.storeId} and (id=any(${ids}) or (${unitId}<>'' and data->'retailOrigin'->>'unitId'=${unitId})) order by id`;
  state.intakes = rows.map(row => row.data);
  state.signatures = rows.flatMap(row => row.signatures);
  state.workflows = Object.fromEntries(rows.filter(row => row.workflow).map(row => [row.data.id, row.workflow]));
}
const text = (value: unknown) => typeof value === "string" ? value : "";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};

/** Domain validators still receive every dependency they use, under the existing store lock. */
export async function loadCommandState(tx: TransactionSql, storeId: string, member: StaffMember, kind: string, payload: Record<string, unknown>) {
  const state = await emptyState(tx, storeId, member);
  if (kind.startsWith("intake.") || kind === "repair.workflow") {
    const id = text(kind === "intake.save" ? object(payload.data).id : payload.id);
    await repairs(tx, state, [id]);
    if (kind === "repair.workflow") state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and repair_id=${id} order by id`).map(row => row.data);
  } else if (kind === "procurement") {
    const draft = object(payload.record);
    const id = text(["append", "link_requirement"].includes(text(payload.type)) ? payload.id : draft.id);
    state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and id=${id}`).map(row => row.data);
    await repairs(tx, state, [text(state.procurement[0]?.repairId ?? draft.repairId)]);
  } else if (kind === "procurement.batch") {
    // The command validates shape/size; bound dependencies before touching the database.
    const items = Array.isArray(payload.items) && payload.items.length <= 100 ? payload.items : [];
    const ids = [...new Set(items.map(item => text(object(item).id)).filter(Boolean))];
    if (ids.length) {
      state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and id=any(${ids}) order by id`).map(row => row.data);
      await repairs(tx, state, [...new Set(state.procurement.map(row => row.repairId))]);
    }
  } else if (kind === "retail" || kind === "retail.aftersale_repair") {
    const id = text(kind === "retail.aftersale_repair" ? payload.unitId : payload.type === "create" ? object(payload.unit).id : payload.id);
    state.retail = (await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} and id=${id}`).map(row => row.data);
    const command = object(payload.command);
    // Code allocation and cross-record identity validation use only these identity facts.
    if (payload.type === "create" || command.type === "edit") {
      const identities = await tx`select jsonb_build_object('id',id,'code',data->'code','brand',data->'brand','serial',data->'serial','imei1',data->'imei1','imei2',data->'imei2') as data
        from chinatech_v2_private.retail_units where store_id=${storeId} and id<>${id} order by id`;
      state.retail.push(...identities.map(row => row.data));
    }
    if (kind === "retail.aftersale_repair" || command.type === "after_sale_link" || command.type === "after_sale_close") {
      await repairs(tx, state, [text(payload.repairId), text(command.repairId)], id);
    }
  } else if (kind === "customer.save") {
    const phone = normalizeCustomerPhone(text(object(payload.draft).phone));
    state.customers = (await tx`select data from chinatech_v2_private.customers where store_id=${storeId} and normalized_phone=${phone}`).map(row => row.data);
  }
  return state;
}

/** A receipt never re-reads the shop. Recovery can confirm it even if a view refresh fails. */
export async function loadReceiptState(tx: TransactionSql, storeId: string, member: StaffMember, operation: OperationReceipt, entityId = operation.entityId) {
  const state = await emptyState(tx, storeId, member);
  if (operation.kind.startsWith("intake.") || operation.kind === "repair.workflow" || operation.kind === "retail.aftersale_repair") await repairs(tx, state, [entityId]);
  if (operation.kind === "procurement") {
    state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and id=${entityId}`).map(row => row.data);
    await repairs(tx, state, state.procurement.map(row => row.repairId));
  }
  if (operation.kind === "procurement.batch") {
    state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId}
      and exists (select 1 from jsonb_array_elements(data->'events') event where event->>'batchId'=${operation.requestId}) order by id`).map(row => row.data);
    await repairs(tx, state, [...new Set(state.procurement.map(row => row.repairId))]);
  }
  if (operation.kind === "retail" || operation.kind === "retail.aftersale_repair") {
    const unitId = operation.kind === "retail" ? entityId : state.intakes[0]?.retailOrigin?.unitId ?? "";
    state.retail = (await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} and id=${unitId}`).map(row => row.data);
  }
  if (operation.kind === "customer.save") state.customers = (await tx`select data from chinatech_v2_private.customers where store_id=${storeId} and normalized_phone=coalesce(nullif(${entityId},''),
    (select entity_id from chinatech_v2_private.audit_events where store_id=${storeId} and request_id=${operation.requestId} and actor_id=(current_setting('request.jwt.claims')::jsonb->>'sub')::uuid))`).map(row => row.data);
  state.retail=state.retail.map(referenceRetailPhotos);
  return { ...projectState(state, member), delta: true, operation };
}
