import type {BackendReadScope} from "./read-plan";
export const repairScanVersionChangedCode="READ_VERSION_CHANGED";
export type RepairScanCandidate={id:string;model:string;serial:string};
export type RepairScanPage={scope:BackendReadScope;raw:string;stateToken:string;generation:string;startIndex:number;total:number;items:RepairScanCandidate[];nextCursor:string|null};
