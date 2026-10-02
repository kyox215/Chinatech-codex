import type { StaffData } from "../staff";
import type { StoreSettings } from "../store-settings";
import type { CustomerProfile } from "../customers";
import type { IntakeReceiptData, IntakeSignature } from "../repair-intake-record";
import type { RepairWorkflow } from "../repair-workflow";
import type { ProcurementRecord } from "../procurement";
import type { RetailUnit } from "../retail";
import type { RetailHistoryRecord } from "../retail-history";

export type BackendSnapshot = {
  operation?: OperationReceipt;
  stateToken?: string;
  storeId: string; revision: number; staff: StaffData; settings: StoreSettings;
  intakes: IntakeReceiptData[]; signatures: IntakeSignature[];
  workflows: Record<string, RepairWorkflow>; procurement: ProcurementRecord[];
  retail: RetailUnit[]; retailHistory?: RetailHistoryRecord[]; customers: CustomerProfile[];
};
export type UnchangedState = { unchanged: true; stateToken: string; storeId: string; memberId: string; revision: number };
export type OperationReceipt = { requestId: string; entityId: string; kind: string; committedAt: string; replayed: boolean };
export type BackendCommand = { requestId: string; storeId: string; memberId: string; kind: string; payload: unknown };
