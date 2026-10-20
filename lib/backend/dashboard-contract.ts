import type {BackendReadScope} from './read-plan';
import type {RepairTone} from '../repair-fixtures';
import type {WorkflowGroup} from '../repair-workflow';
import type {ProcurementStatus} from '../procurement';
import type {RepairGroupItem} from '../repair-groups';

/** Display summaries only. They are never supplied to a canonical writer. */
export type DashboardRepair = {
  id:string; brand:string; model:string; customerName:string; customerNameMissing:boolean;
  issue:string; faults?:string[]; issueNote?:string; previews:string[];
  progress:{label:string;tone:RepairTone};
};
export type DashboardProcurement = {
  id:string; repairId:string; item:string; supplier:string; quantity:number;
  arrived:number; status:ProcurementStatus; expectedAt:string; previews:string[];
};
export type DashboardActivity = {
  key:string; id:string; source:'intake'|'repair'|'procurement'|'retail'; entityId:string;
  repairId:string; time:string; type:string; label:string; display:string;
  quantity:number|null; previews:string[];
};
export type DashboardData = {
  counts:Record<WorkflowGroup,number>; debtCount:number;
  groups:RepairGroupItem<WorkflowGroup>[]; recent:DashboardRepair[];
  procurement:{total:number;pending:DashboardProcurement[]};
  retail:{available:number;sold:number;other:number}; activity:DashboardActivity[];
};
export type DashboardPage = {
  formatVersion:1; scope:BackendReadScope; stateToken:string;
  generation:string; data:DashboardData;
};
