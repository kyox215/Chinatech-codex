import type { StaffMember } from "../staff";
import {procurementListQuery,type ProcurementListQuery} from "./procurement-list-contract";

export const backendDomains = ["settings", "staff", "intakes", "signatures", "workflows", "procurement", "retail", "retailHistory", "customers"] as const;
export type BackendDomain = typeof backendDomains[number];
export const pageKinds = ["session", "catalog", "dashboard", "repairs", "repair", "repair-new", "procurement", "procurement-detail", "procurement-new", "retail", "retail-unit", "retail-new", "customers", "customer", "customer-devices", "settings"] as const;
export type PageReadPlan = { kind: typeof pageKinds[number]; id?: string; q?: string; anchor?: string; query?: ProcurementListQuery };
export type BackendReadScope = { accountId: string; sessionId: string; storeId: string; memberId: string; memberRevision: number; permissions: string[]; formatVersion: 2 };
export type SessionBootstrap = { formatVersion: 2; scope: BackendReadScope; revision: number; storeName: string; member: StaffMember };
export type BackendReadState = { formatVersion: 2; scope: BackendReadScope; plan: PageReadPlan; ready: BackendDomain[] };
export const backendIdentityChangedCode = "IDENTITY_CHANGED";

export function pagePlanKey(plan: PageReadPlan) { return JSON.stringify([plan.kind, plan.id ?? "", plan.q ?? "", plan.anchor ?? "",plan.query??null]); }
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
  if (Object.keys(plan).some(key => !["kind", "id", ...(plan.kind === "customers" ? ["q","anchor"] : plan.kind==="procurement"?["query","anchor"]:[])].includes(key)) || !pageKinds.includes(plan.kind as PageReadPlan["kind"])) throw new Error("请求资料无效。");
  const needsId = ["repair", "procurement-detail", "retail-unit", "customer"].includes(plan.kind as string);
  if (needsId ? typeof plan.id !== "string" || !plan.id || plan.id.length > 100 : plan.id !== undefined) throw new Error("请求资料无效。");
  if(plan.q!==undefined&&(typeof plan.q!=="string"||plan.q.length>160)||plan.anchor!==undefined&&(typeof plan.anchor!=="string"||!(plan.kind==="procurement"?plan.anchor.length>0&&plan.anchor.length<=100:/^\+[1-9]\d{6,14}$/.test(plan.anchor))))throw new Error("请求资料无效。");
  const query=plan.kind==="procurement"&&plan.query!==undefined?procurementListQuery(plan.query as Partial<ProcurementListQuery>):undefined;
  return { kind: plan.kind as PageReadPlan["kind"], ...(needsId ? { id: plan.id as string } : {}), ...(typeof plan.q === "string" && plan.q.trim() ? {q:plan.q.trim().toLowerCase()}:{}), ...(typeof plan.anchor === "string" ? {anchor:plan.anchor}:{}),...(query?{query}:{}) };
}

// These compatibility plans preserve the existing full-domain semantics until
// each list is moved to its versioned summary API. They are never advertised as
// paginated lists; unrelated store domains and signature history are omitted.
export function pageDomains(plan: PageReadPlan, options?: {customerLists?:boolean;procurementLists?:boolean}): BackendDomain[] {
  if (plan.kind === "session" || plan.kind === "catalog" || plan.kind === "customers" && options?.customerLists ||plan.kind==="procurement"&&options?.procurementLists) return ["staff"];
  if (plan.kind === "repair") return ["staff", "settings", "intakes", "signatures", "workflows", "procurement"];
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
