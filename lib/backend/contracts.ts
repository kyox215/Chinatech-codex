import type { StaffData } from "../staff";
import type { StoreSettings } from "../store-settings";
import type { CustomerProfile } from "../customers";
import type { IntakeReceiptData, IntakeSignature } from "../repair-intake-record";
import type { RepairWorkflow } from "../repair-workflow";
import type { ProcurementRecord } from "../procurement";
import type { RetailUnit } from "../retail";
import type { RetailHistoryRecord } from "../retail-history";
import type { RepairDirectoryEntry } from "../repair-intake-record";
import type { Customer } from "../customers";
import type { RepairListGroup } from "../repair-list-model";
import type { queryRetailList } from "../retail-list-model";

export type BackendSnapshot = {
  /** A page projection replaces the previous page; a command delta merges only committed entities. */
  scope?: string;
  delta?: boolean;
  directory?: RepairDirectoryEntry[];
  views?: {
    repairs?: { total: number; groups: (RepairListGroup & { count: number; page: number; pageCount: number })[] };
    retail?: ReturnType<typeof queryRetailList>;
    retailManagement?: { total:number;page:number;pageCount:number;statusCounts:Record<string,number>;conditionCounts:Record<string,number> };
    customers?: { rows: Customer[]; total: number; page: number; pageCount: number; counts?: Record<string, { repairs: number; sales: number; history: number }> };
    procurementBatch?: {total:number;counts:Record<string,number>;unresolved:number;page:number;pageCount:number};
    procurement?: { total: number; page: number; pageCount: number; counts: Record<string, number>; groups: Record<string, number> };
    dashboard?: { repairCount:number;groups:Record<string,number>;stats:number[];retailCounts:Record<string,number>;procurementCount:number;activity:{id:string;title:string;time:string;href:string;tone:string}[] };
    devices?: { rows: {key:string;category:string;model:string;serial:string;records:{id:string;phone:string;time:string;type:"repair"|"sale";href:string}[];recordCount:number}[];total:number;page:number;pageCount:number };
  };
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
