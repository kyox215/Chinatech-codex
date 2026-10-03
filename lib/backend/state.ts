import type { TransactionSql } from "postgres";
import { createHash } from "node:crypto";
import { can, type StaffMember, type StaffData } from "../staff";
import { projectRetailForStaff } from "../retail-access";
import type { BackendSnapshot } from "./contracts";
import type { IntakeReceiptData, IntakeSignature } from "../repair-intake-record";
import type { ProcurementRecord } from "../procurement";
import type { RetailUnit } from "../retail";
import { projectRetailHistory, type RetailHistoryRecord } from "../retail-history";
import type { CustomerProfile } from "../customers";
import type { RepairWorkflow } from "../repair-workflow";
import type { StoreSettings } from "../store-settings";
import { BackendError } from "./database";

export type StateHeader = { revision: number; settings: StoreSettings; staff: StaffData; stateToken: string };

// Increment this when the serialized projection changes without a business write.
const projectionVersion = 3;
export async function loadStateHeader(tx: TransactionSql, storeId: string, member: StaffMember): Promise<StateHeader> {
  const [store] = await tx`select revision,settings,staff_audit from chinatech_v2_private.store_state where store_id=${storeId}`;
  if (!store) throw new BackendError("门店尚未完成初始化。", 503);
  const roster = await tx`select m.id,m.role,m.permissions,m.revision,m.membership_status,a.account_status,a.display_name,a.email from chinatech_v2.store_memberships m join chinatech_v2.accounts a on a.id=m.user_id where m.store_id=${storeId} order by m.id`;
  const revision = Number(store.revision);
  const staff: StaffData = { revision, currentId: member.id, audit: can(member,"staff.manage") ? store.staff_audit : [], members: roster.map(row => ({ id:row.id,name:row.display_name || row.email,email:row.email,role:row.role,permissions:row.permissions,revision:row.revision,accountStatus:row.account_status,membershipStatus:row.membership_status })) };
  // Account/roster changes can happen without bumping store_state.revision.
  // This is a cache validator, never an authentication or authorization token.
  const stateToken = createHash("sha256").update(JSON.stringify([projectionVersion, storeId, member.id, revision, staff.members])).digest("hex");
  return { revision, settings: store.settings as StoreSettings, staff, stateToken };
}

export async function loadState(tx: TransactionSql, storeId: string, member: StaffMember, header?: StateHeader): Promise<BackendSnapshot> {
  const current = header ?? await loadStateHeader(tx, storeId, member);
  const intakes = await tx`select data,signatures,workflow from chinatech_v2_private.repair_intakes where store_id=${storeId} order by id`;
  const procurement = await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} order by id`;
  const retail = await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} order by id`;
  const retailHistory = can(member,"retail.view") ? await tx`select data from chinatech_v2_private.retail_history_records where store_id=${storeId} order by source_row` : [];
  const customers = await tx`select data from chinatech_v2_private.customers where store_id=${storeId} order by normalized_phone`;
  return { storeId, revision: current.revision, stateToken: current.stateToken, staff: current.staff, settings: current.settings,
    intakes: intakes.map(row => row.data as IntakeReceiptData), signatures: intakes.flatMap(row => row.signatures as IntakeSignature[]),
    workflows: Object.fromEntries(intakes.filter(row => row.workflow).map(row => [(row.data as IntakeReceiptData).id,row.workflow as RepairWorkflow])),
    procurement: procurement.map(row => row.data as ProcurementRecord), retail: retail.map(row => row.data as RetailUnit), retailHistory: retailHistory.map(row => row.data as RetailHistoryRecord), customers: customers.map(row => row.data as CustomerProfile) };
}
// This projection runs before serialization. Financial values never enter an unauthorized client.
export function projectState(state: BackendSnapshot, member: StaffMember): BackendSnapshot {
  const financial = can(member,"financial.read");
  return { ...state,
    settings: { ...state.settings, finance: financial ? state.settings.finance : [] },
    intakes: can(member,"repairs.view") ? state.intakes : [], signatures: can(member,"repairs.view") ? state.signatures : [],
    workflows: can(member,"repairs.view") ? state.workflows : {},
    procurement: can(member,"repairs.view") ? state.procurement.map(row => financial ? row : { ...row, unitCostCents: null }) : [],
    retail: projectRetailForStaff(state.retail,member), retailHistory: projectRetailHistory(state.retailHistory??[],member), customers: can(member,"customers.view") ? state.customers : [] };
}
