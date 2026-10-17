import{retailListQuery,type RetailListQuery}from"./retail-list-contract";
import type { StaffMember } from "../staff";
import {procurementListQuery,type ProcurementListQuery} from "./procurement-list-contract";
import {repairListQuery,type RepairListQuery} from "./repair-list-contract";

export const backendDomains = ["settings", "staff", "intakes", "signatures", "workflows", "procurement", "retail", "retailHistory", "customers"] as const;
export type BackendDomain = typeof backendDomains[number];
export const pageKinds = ["session", "catalog", "dashboard", "repairs", "repair", "repair-operation", "repair-new", "procurement", "procurement-detail", "procurement-new", "retail", "retail-unit", "retail-new", "customers", "customer", "customer-devices", "settings"] as const;
export type PageReadPlan = { kind: typeof pageKinds[number]; id?: string; purpose?:"stage"|"contact"|"parts"; q?: string; anchor?: string; query?: ProcurementListQuery;repairQuery?:RepairListQuery;retailQuery?:RetailListQuery;retailSource?:"unit"|"history";group?:string };
export type BackendReadScope = { accountId: string; sessionId: string; storeId: string; memberId: string; memberRevision: number; permissions: string[]; formatVersion: 2 };
export type SessionBootstrap = { formatVersion: 2; scope: BackendReadScope; revision: number; storeName: string; member: StaffMember };
export type BackendReadState = { formatVersion: 2; scope: BackendReadScope; plan: PageReadPlan; ready: BackendDomain[] };
export const backendIdentityChangedCode = "IDENTITY_CHANGED";

export function pagePlanKey(plan: PageReadPlan) { return JSON.stringify([plan.kind, plan.id ?? "", plan.q ?? "", plan.anchor ?? "",plan.query??null,plan.purpose??"",plan.repairQuery??null,plan.group??"",plan.retailQuery??null,plan.retailSource??""]); }
export function backendScopeKey(scope: BackendReadScope) {
  return JSON.stringify([scope.formatVersion, scope.accountId, scope.sessionId, scope.storeId, scope.memberId, scope.memberRevision, [...scope.permissions].sort()]);
}
export function backendIdentityKey(scope: BackendReadScope) { return JSON.stringify([scope.accountId, scope.sessionId, scope.storeId, scope.memberId]); }
export function backendDomainReady(value: { read?: BackendReadState } | null | undefined, domain: BackendDomain) {
  return Boolean(value && (!value.read || value.read.ready.includes(domain)));
}
export function parsePageReadPlan(value: unknown): PageReadPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求资料无效。");
  const plan = value as Record<string, unknown>;
  if (Object.keys(plan).some(key => !["kind", "id", ...(plan.kind === "customers" ? ["q","anchor"] : plan.kind==="procurement"?["query","anchor"]:plan.kind==="repairs"?["repairQuery","group","anchor"]:plan.kind==="repair-operation"?["purpose"]:plan.kind==="retail"?["retailQuery","anchor"]:plan.kind==="retail-unit"?["retailSource"]:[])].includes(key)) || !pageKinds.includes(plan.kind as PageReadPlan["kind"])) throw new Error("请求资料无效。");
  const optionalId=plan.kind==="procurement-new"&&plan.id!==undefined;
  const needsId = ["repair", "repair-operation", "procurement-detail", "retail-unit", "customer"].includes(plan.kind as string);
  if (needsId||optionalId ? typeof plan.id !== "string" || !plan.id || plan.id.length > 100 : plan.id !== undefined) throw new Error("请求资料无效。");
  if(plan.q!==undefined&&(typeof plan.q!=="string"||plan.q.length>160)||plan.anchor!==undefined&&(typeof plan.anchor!=="string"||!(["procurement","repairs","retail"].includes(String(plan.kind))?plan.anchor.length>0&&plan.anchor.length<=(plan.kind==="retail"?108:100):/^\+[1-9]\d{6,14}$/.test(plan.anchor))))throw new Error("请求资料无效。");
  if(plan.retailSource!==undefined&&(typeof plan.retailSource!=="string"||!["unit","history"].includes(plan.retailSource)))throw new Error("请求资料无效。");
  const query=plan.kind==="procurement"&&plan.query!==undefined?procurementListQuery(plan.query as Partial<ProcurementListQuery>):undefined;
  if(plan.kind==="repair-operation"&&!["stage","contact","parts"].includes(plan.purpose as string))throw new Error("请求资料无效。");
  if(plan.group!==undefined&&(typeof plan.group!=="string"||!["all","history","rework","processing","purchase","ready","draft","cart","mixed","ordered","complete","unrecorded"].includes(plan.group)))throw new Error("请求资料无效。");
  return { kind: plan.kind as PageReadPlan["kind"], ...(needsId||optionalId ? { id: plan.id as string } : {}), ...(typeof plan.q === "string" && plan.q.trim() ? {q:plan.q.trim()}:{}), ...(typeof plan.anchor === "string" ? {anchor:plan.anchor}:{}),...(query?{query}:{}),...(plan.kind==="retail"&&plan.retailQuery!==undefined?{retailQuery:retailListQuery(plan.retailQuery as Partial<RetailListQuery>)}:{}),...(plan.kind==="repair-operation"?{purpose:plan.purpose as PageReadPlan["purpose"]}:{}),...(plan.kind==="repairs"&&plan.repairQuery!==undefined?{repairQuery:repairListQuery(plan.repairQuery as Partial<RepairListQuery>)}:{}),...(typeof plan.retailSource==="string"?{retailSource:plan.retailSource as PageReadPlan["retailSource"]}:{}),...(typeof plan.group==="string"?{group:plan.group}:{}) };
}

// These compatibility plans preserve the existing full-domain semantics until
// each list is moved to its versioned summary API. They are never advertised as
// paginated lists; unrelated store domains and signature history are omitted.
export function pageDomains(plan: PageReadPlan, options?: {customerLists?:boolean;procurementLists?:boolean;repairLists?:boolean;retailLists?:boolean}): BackendDomain[] {
  if (plan.kind === "session" || plan.kind === "catalog" || plan.kind === "customers" && options?.customerLists ||plan.kind==="procurement"&&options?.procurementLists||plan.kind==="repairs"&&options?.repairLists||plan.kind==="retail"&&options?.retailLists) return ["staff"];
  if(plan.kind==="repair-new"&&options?.repairLists&&options.customerLists||plan.kind==="procurement-new"&&options?.procurementLists)return ["staff"];
  if (plan.kind === "repair") return ["staff", "settings", "intakes", "signatures", "workflows", "procurement"];
  if(plan.kind==="repair-operation")return ["staff",...(plan.purpose==="parts"?["settings" as const]:[]),"intakes","workflows","procurement"];
  if (["repairs", "procurement", "procurement-detail", "procurement-new"].includes(plan.kind)) return ["staff", "settings", "intakes", "workflows", "procurement"];
  if (["retail", "retail-new"].includes(plan.kind)) return ["staff", "settings", "retail", "retailHistory"];
  if (plan.kind === "retail-unit") return ["staff", "settings", "retail", "retailHistory", "intakes", "workflows"];
  if (plan.kind === "customer") return ["staff", "settings", "intakes", "workflows", "procurement", "retail", "retailHistory", "customers"];
  if (plan.kind === "settings") return ["staff", "settings", "intakes", "workflows", "retail"];
  if (plan.kind === "customer-devices") return ["staff", "settings", "intakes", "workflows", "retail"];
  const domains: BackendDomain[] = ["staff", "settings", "intakes", "workflows", "retail", "retailHistory", "customers"];
  if (plan.kind === "dashboard") domains.push("procurement");
  return domains;
}
