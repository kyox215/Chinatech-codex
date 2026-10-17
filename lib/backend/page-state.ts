import "server-only";
import{readRetailCreationDefaults,readRetailFormCandidates,readRetailIdentityConflict}from'./retail-form-read';
import{readRetailScan}from"./retail-scan-read";
import type{RetailScanQuery}from"./retail-scan-contract";
import{retailModelGeneration,retailReadToken,readRetailList,readRetailFacets}from"./retail-list-read";
import{retailListQuery,type RetailListQuery,type RetailFacetQuery}from"./retail-list-contract";
import{readIntakeHistory,readIntakeDraftMetadata}from'./intake-lookup-read';
import {readRepairScan} from "./repair-scan-read";
import {repairReadContext,readRepairList,validateRepairListOptions} from "./repair-list";
import type {RepairListQuery} from "./repair-list-contract";
import { customerModelGeneration, customerListToken, readCustomerList } from "./customer-list";
import { customerListQuery,customerListResponseVersion } from "./customer-list-contract";
import {procurementModelGeneration,procurementListToken,readProcurementList} from "./procurement-list";
import {procurementListResponseVersion,procurementListQuery,type ProcurementListQuery} from "./procurement-list-contract";
import {readProcurementBatch} from "./procurement-batch-read";
import type {ProcurementBatchQuery} from "./procurement-batch-contract";
import { cache } from "react";
import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getServerAccess, getAuthIdentity, memberForRead } from "./context";
import { BackendError, withReadDatabase } from "./database";
import { can, type StaffMember } from "../staff";
import type { BackendSnapshot } from "./contracts";
import { projectState } from "./state";
import { backendIdentityChangedCode, backendScopeKey, pageDomains, pagePlanKey, type BackendReadScope, type PageReadPlan, type SessionBootstrap } from "./read-plan";

// React cache is request-scoped here; no authenticated snapshot is kept in a
// server module cache or reused by another account/request.
export const getPageAccess = cache(() => getServerAccess());
type ReadAccess = Pick<NonNullable<Awaited<ReturnType<typeof getServerAccess>>>,"identity"|"storeId">;
export function backendRetailListsEnabled(){return process.env.BACKEND_RETAIL_LIST_READS==="1";}
export function backendRetailFormsEnabled(){return process.env.BACKEND_RETAIL_FORM_READS==='1';}
export function backendCustomerListsEnabled() { return process.env.BACKEND_CUSTOMER_LIST_READS === "1"; }
export function backendRepairListsEnabled() { return process.env.BACKEND_REPAIR_LIST_READS === "1"; }
export function backendProcurementListsEnabled() { return process.env.BACKEND_PROCUREMENT_LIST_READS === "1"; }
export function backendV2ReadsEnabled() { return process.env.BACKEND_V2_READS !== "0"; }
function scopeFor(access: ReadAccess, member: StaffMember): BackendReadScope {
  return { formatVersion: 2, accountId: access.identity.userId, sessionId: access.identity.sessionId, storeId: access.storeId, memberId: member.id, memberRevision: member.revision, permissions: [...member.permissions].sort() };
}
async function sessionInTransaction(tx: TransactionSql, access: ReadAccess, member: StaffMember): Promise<SessionBootstrap> {
  const [row] = await tx`select st.revision,s.name from chinatech_v2_private.store_state st join chinatech_v2.stores s on s.id=st.store_id where st.store_id=${access.storeId}`;
  if (!row) throw new BackendError("门店尚未完成初始化。", 503);
  return { formatVersion: 2, scope: scopeFor(access, member), revision: Number(row.revision), storeName: row.name, member };
}
export function sessionSnapshot(bootstrap: SessionBootstrap): BackendSnapshot {
  const snapshot: BackendSnapshot = { customerListEnabled: backendCustomerListsEnabled(), storeId: bootstrap.scope.storeId, revision: bootstrap.revision, staff: { revision: bootstrap.revision, currentId: bootstrap.member.id, members: [bootstrap.member], audit: [] }, settings: null, intakes: [], signatures: [], workflows: {}, procurement: [], retail: [], retailHistory: [], customers: [], read: { formatVersion: 2, scope: bootstrap.scope, plan: { kind: "session" }, ready: ["staff"] } };
  snapshot.retailFormEnabled=backendRetailFormsEnabled();snapshot.retailListEnabled=backendRetailListsEnabled();snapshot.procurementListEnabled=backendProcurementListsEnabled();snapshot.repairListEnabled=backendRepairListsEnabled();
  snapshot.stateToken = pageToken(snapshot);
  return snapshot;
}
function pageToken(snapshot: BackendSnapshot, listGeneration?: string,procurementGeneration?:string,repairToken?:string,retailGeneration?:string) {
  return createHash("sha256").update(JSON.stringify([backendScopeKey(snapshot.read!.scope), snapshot.revision, pagePlanKey(snapshot.read!.plan), snapshot.staff.members, snapshot.customerListEnabled,snapshot.retailListEnabled,snapshot.retailFormEnabled,snapshot.procurementListEnabled,snapshot.repairListEnabled,snapshot.customerListEnabled?customerListResponseVersion:null,snapshot.procurementListEnabled?procurementListResponseVersion:null, listGeneration,procurementGeneration,repairToken,retailGeneration])).digest("hex");
}
export async function loadSessionBootstrap(access: ReadAccess) {
  return withReadDatabase(access.identity, access.storeId, async tx => sessionInTransaction(tx, access, await memberForRead(tx, access.storeId, access.identity.userId)));
}
export async function getV2Access(request: Request): Promise<ReadAccess> {
  const identity = await getAuthIdentity();
  const storeId = request.headers.get("x-ct-store-id");
  if (!storeId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(storeId)) throw new BackendError("请明确选择门店。", 400);
  // This is an identity and validated store selector, not an authorization
  // result. Every loader checks the live session and member in its own read
  // transaction, avoiding a duplicate transaction whose member was unused.
  return {identity,storeId};
}

export async function loadPageState(access: ReadAccess, plan: PageReadPlan, known?: string, expectedScope?: string) {
  return withReadDatabase(access.identity, access.storeId, async tx => {
    const member = await memberForRead(tx, access.storeId, access.identity.userId);
    const bootstrap = await sessionInTransaction(tx, access, member);
    if (expectedScope && expectedScope !== backendScopeKey(bootstrap.scope)) throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。", 409, backendIdentityChangedCode);
    const state = sessionSnapshot(bootstrap), domains = pageDomains(plan,{customerLists:backendCustomerListsEnabled(),procurementLists:backendProcurementListsEnabled(),repairLists:backendRepairListsEnabled(),retailLists:backendRetailListsEnabled(),retailForms:backendRetailFormsEnabled()});
    state.read = { formatVersion: 2, scope: bootstrap.scope, plan, ready: domains };
    if (plan.kind === "settings") {
      // Existing staff/settings semantics remain explicit to this page while its
      // dedicated roster/history read is migrated; no arbitrary member cap.
      const roster = await tx`select m.id,m.role,m.permissions,m.revision,m.membership_status,a.account_status,a.display_name,a.email from chinatech_v2.store_memberships m join chinatech_v2.accounts a on a.id=m.user_id where m.store_id=${access.storeId} order by m.id`;
      state.staff.members = roster.map(row => ({ id: row.id, name: row.display_name || row.email, email: row.email, role: row.role, permissions: row.permissions, revision: row.revision, accountStatus: row.account_status, membershipStatus: row.membership_status }));
      if (plan.kind === "settings" && can(member, "staff.manage")) { const [row] = await tx`select staff_audit from chinatech_v2_private.store_state where store_id=${access.storeId}`; state.staff.audit = row.staff_audit; }
    }
    const customerGeneration = plan.kind === "customers" && backendCustomerListsEnabled() && can(member,"customers.view") ? await customerModelGeneration(tx,access.storeId) : undefined;
    const procurementGeneration=plan.kind==="procurement"&&backendProcurementListsEnabled()&&can(member,"repairs.view")?await procurementModelGeneration(tx,access.storeId):undefined;
    const repairContext=plan.kind==="repairs"&&backendRepairListsEnabled()&&can(member,"repairs.view")?await repairReadContext(tx,bootstrap.scope,plan.repairQuery):undefined;
    const retailGeneration=plan.kind==="retail"&&backendRetailListsEnabled()&&can(member,"retail.view")?await retailModelGeneration(tx,access.storeId):undefined;
    state.stateToken = pageToken(state,customerGeneration,procurementGeneration,repairContext?.stateToken,retailGeneration);
    if (known === state.stateToken) return { unchanged: true as const, stateToken: state.stateToken, storeId: state.storeId, memberId: member.id, revision: state.revision };
    if(plan.kind === "customer" && !can(member,"customers.view")) { state.read.ready=["staff"]; return state; }
    if(retailGeneration!==undefined)state.retailList=await readRetailList(tx,bootstrap.scope,plan.retailQuery,{generation:retailGeneration,anchor:plan.anchor});
    if (customerGeneration !== undefined) state.customerList = await readCustomerList(tx,bootstrap.scope,plan.q??"",undefined,customerGeneration,"directory",plan.anchor);
    if(procurementGeneration!==undefined)state.procurementList=await readProcurementList(tx,bootstrap.scope,plan.query,{generation:procurementGeneration,anchor:plan.anchor});
    if(repairContext)state.repairList=await readRepairList(tx,bootstrap.scope,plan.repairQuery,{context:repairContext,group:plan.group,anchor:plan.anchor});
    if(plan.kind==="repair-new"&&backendRepairListsEnabled()&&backendCustomerListsEnabled()){
      const[row]=await tx`select revision,settings->>'paper' paper,jsonb_build_object('months',settings->'repairWarrantyMonths','shopName',settings->'shopName','address',settings->'address','phone',settings->'phone') policy from chinatech_v2_private.store_state where store_id=${access.storeId}`;
      if(!row)throw new BackendError("门店尚未完成初始化。",503);
      state.intakeDefaults={revision:Number(row.revision),policy:{months:row.policy.months,shopName:row.policy.shopName,address:row.policy.address,phone:row.policy.phone},paper:row.paper};
    }
    if(plan.kind==="procurement-new"&&backendProcurementListsEnabled()&&can(member,"repairs.view")){
      state.procurementRepairCandidate=null;
      if(plan.id){const value=await readProcurementBatch(tx,bootstrap.scope,{kind:"repairs",q:"",repairId:plan.id,supplierId:""});state.procurementRepairCandidate=value.items[0] as import("./procurement-batch-contract").ProcurementRepairCandidate??null;}
    }
    if(plan.kind==='retail-new'&&backendRetailFormsEnabled()&&can(member,'retail.view')&&can(member,'retail.edit'))state.retailCreationDefaults=await readRetailCreationDefaults(tx,bootstrap.scope,plan.id);
    if (domains.includes("settings")) {
      // Finance is read only by its own settings page. A print/default policy
      // read never transfers the whole finance ledger into another module.
      const [row] = plan.kind === "settings" && can(member, "financial.read")
        ? await tx`select settings from chinatech_v2_private.store_state where store_id=${access.storeId}`
        : await tx`select (settings-'finance')||'{"finance":[]}'::jsonb as settings from chinatech_v2_private.store_state where store_id=${access.storeId}`;
      state.settings = row.settings;
    }
    const targetedCustomer=plan.kind === "customer" && backendCustomerListsEnabled();
    const customerPhone=targetedCustomer && /^PHONE-[1-9]\d{6,14}$/.test(plan.id??"") ? "+"+plan.id!.slice(6) : null;
    if(targetedCustomer && !customerPhone)throw new BackendError("记录标识无效。",400);
    let intakeIds: string[] | null = null;
    if(customerPhone) {
      intakeIds=(await tx`select id from chinatech_v2_private.repair_intakes where store_id=${access.storeId} and chinatech_v2_private.directory_phone(data->>'phone')=${customerPhone}`).map(row=>row.id);
    } else if(plan.kind==="repair-operation"){
      if(!can(member,"repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
      intakeIds=[plan.id!];
    } else if (plan.kind === "repair") {
      const rows = await tx`select id from chinatech_v2_private.repair_intakes where store_id=${access.storeId} and (id=${plan.id!} or data->'repairOrigin'->>'repairId'=${plan.id!} or id=(select data->'repairOrigin'->>'repairId' from chinatech_v2_private.repair_intakes where store_id=${access.storeId} and id=${plan.id!}))`;
      intakeIds = rows.map(row => row.id);
    } else if (plan.kind === "procurement-detail") {
      const rows = await tx`select repair_id from chinatech_v2_private.procurement_records where store_id=${access.storeId} and id=${plan.id!}`;
      intakeIds = rows.map(row => row.repair_id);
    } else if (plan.kind === "retail-unit") {
      const rows = await tx`select id from chinatech_v2_private.repair_intakes where store_id=${access.storeId} and data->'retailOrigin'->>'unitId' in (select id from chinatech_v2_private.retail_units where store_id=${access.storeId} and ${plan.retailSource==='history'?tx`data->'historyOrigin'->>'recordId'=${plan.id!}`:plan.retailSource==='unit'?tx`id=${plan.id!}`:tx`(id=${plan.id!} or data->'historyOrigin'->>'recordId'=${plan.id!})`})`;
      intakeIds = rows.map(row => row.id);
    }
    if (domains.includes("intakes") && can(member, "repairs.view")) {
      const where = intakeIds === null ? tx`` : tx`and id=any(${tx.array(intakeIds, 25)})`;
      const rows = domains.includes("signatures")
        ? await tx`select data,workflow,signatures from chinatech_v2_private.repair_intakes where store_id=${access.storeId} ${where} order by id`
        : await tx`select data,workflow from chinatech_v2_private.repair_intakes where store_id=${access.storeId} ${where} order by id`;
      state.intakes = rows.map(row => row.data);
      state.workflows = Object.fromEntries(rows.filter(row => row.workflow).map(row => [row.data.id, row.workflow]));
      if (domains.includes("signatures")) state.signatures = rows.filter(row => row.data.id === plan.id).flatMap(row => row.signatures);
    }
    if (domains.includes("procurement") && can(member, "repairs.view")) {
      const where = intakeIds === null ? tx`` : tx`and repair_id=any(${tx.array(intakeIds, 25)})`;
      state.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${access.storeId} ${where} order by id`).map(row => row.data);
    }
    if (domains.includes("retail") && can(member, "retail.view")) {
      const where = customerPhone ? tx`and exists(select 1 from jsonb_array_elements(data->'sales') sale where chinatech_v2_private.directory_phone(sale->>'customerPhone')=${customerPhone})` : plan.kind === "retail-unit" ? tx`and ${plan.retailSource==='history'?tx`data->'historyOrigin'->>'recordId'=${plan.id!}`:plan.retailSource==='unit'?tx`id=${plan.id!}`:tx`(id=${plan.id!} or data->'historyOrigin'->>'recordId'=${plan.id!})`}` : tx``;
      state.retail = (await tx`select data from chinatech_v2_private.retail_units where store_id=${access.storeId} ${where} order by id`).map(row => row.data);
    }
    if (domains.includes("retailHistory") && can(member, "retail.view")) {
      const target=state.retail.find(unit=>unit.id===plan.id),ids=plan.kind==="retail-unit"?(plan.retailSource==="history"?[plan.id!]:target?.historyOrigin?[target.historyOrigin.recordId]:!target&&plan.retailSource!=="unit"?[plan.id!]:[]).filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)):[];
      // History PKs are UUIDs, whereas unit IDs/JSON origin fields are text.
      // Validate the tiny target set before binding its UUID array, retaining
      // the primary-key lookup and ordinary not-found behavior for legacy IDs.
      const where = customerPhone ? tx`and chinatech_v2_private.directory_phone(data->>'customerPhone')=${customerPhone}` : plan.kind === "retail-unit" ? tx`and id=any(${tx.array(ids,2950)})` : tx``;
      state.retailHistory = (await tx`select data from chinatech_v2_private.retail_history_records where store_id=${access.storeId} ${where} order by source_row`).map(row => row.data);
    }
    if (domains.includes("customers") && can(member, "customers.view")) state.customers = (await tx`select data from chinatech_v2_private.customers where store_id=${access.storeId} ${customerPhone?tx`and normalized_phone=${customerPhone}`:tx``} order by normalized_phone`).map(row => row.data);
    return projectState(state, member);
  });
}

export async function loadCustomerListPage(access: ReadAccess, query: string, cursor?: string, known?: string, expectedScope?: string, mode: import("./customer-list-contract").CustomerListQuery["mode"] = "directory", anchor?: string, seek?: number) {
  return withReadDatabase(access.identity,access.storeId,async tx=>{
    const member=await memberForRead(tx,access.storeId,access.identity.userId), scope=scopeFor(access,member);
    if(expectedScope && expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
    if(!can(member,"customers.view"))throw new BackendError("当前账号没有此操作权限。",403);
    const generation=await customerModelGeneration(tx,access.storeId), token=customerListToken(scope,generation,customerListQuery(query,mode));
    if(!cursor && seek===undefined && known===token)return {unchanged:true as const,stateToken:token};
    return readCustomerList(tx,scope,query,cursor,generation,mode,anchor,seek);
  });
}

export async function loadProcurementListPage(access:ReadAccess,raw:Partial<ProcurementListQuery>,options:{cursor?:string;known?:string;anchor?:string;seek?:number;expectedScope?:string}={}) {
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  if(!can(member,"repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
  const generation=await procurementModelGeneration(tx,access.storeId),query=procurementListQuery(raw),token=procurementListToken(scope,generation,query);
  if(!options.cursor&&options.seek===undefined&&options.known===token)return{unchanged:true as const,stateToken:token};
  return readProcurementList(tx,scope,query,{...options,generation});
 });
}
export async function loadProcurementBatchPage(access:ReadAccess,query:Partial<ProcurementBatchQuery>,options:{cursor?:string;ids?:string[];seek?:number;expectedScope?:string}={}) {
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  if(!can(member,"repairs.view")||query.kind!=="repairs"&&!can(member,"repairs.edit"))throw new BackendError("当前账号没有此操作权限。",403);
  return readProcurementBatch(tx,scope,query,options);
 });
}
export async function loadRepairListPage(access:ReadAccess,query:Partial<RepairListQuery>,options:{group?:string;cursor?:string;anchor?:string;seek?:number;known?:string;expectedScope?:string}={}) {
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  if(!can(member,"repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
  const context=await repairReadContext(tx,scope,query);
  validateRepairListOptions(context,options);
  if(!options.cursor&&options.seek===undefined&&options.known===context.stateToken)return{unchanged:true as const,stateToken:context.stateToken};
  return readRepairList(tx,scope,query,{...options,context});
 });
}
export async function loadRepairScanPage(access:ReadAccess,raw:string,origin:string,options:{cursor?:string;seek?:number;expectedScope?:string}={}) {
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  if(!can(member,"repairs.view"))throw new BackendError("当前账号没有此操作权限。",403);
  return readRepairScan(tx,scope,raw,origin,options);
 });
}
export async function loadIntakeHistoryPage(access:ReadAccess,raw:string,options:{cursor?:string;seek?:number;expectedScope?:string}={}){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError('登录身份或页面版本已变化，请刷新后重新核对。',409,backendIdentityChangedCode);
  return readIntakeHistory(tx,scope,raw,options);
 });
}
export async function loadIntakeDraftPage(access:ReadAccess,id:string,expectedScope?:string){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(expectedScope&&expectedScope!==backendScopeKey(scope))throw new BackendError('登录身份或页面版本已变化，请刷新后重新核对。',409,backendIdentityChangedCode);
  return{scope,items:[await readIntakeDraftMetadata(tx,scope,id)]};
 });
}

export async function loadRetailListPage(access:ReadAccess,raw:Partial<RetailListQuery>,options:{cursor?:string;known?:string;anchor?:string;seek?:number;expectedScope?:string}={}){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  if(!can(member,"retail.view"))throw new BackendError("当前账号没有此操作权限。",403);
  const generation=await retailModelGeneration(tx,access.storeId),query=retailListQuery(raw),token=retailReadToken(scope,generation,query);
  if(!options.cursor&&options.seek===undefined&&options.known===token)return{unchanged:true as const,stateToken:token};
  return readRetailList(tx,scope,query,{...options,generation});
 });
}
export async function loadRetailFacetPage(access:ReadAccess,raw:Partial<RetailFacetQuery>,expectedScope?:string){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(expectedScope&&expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  return readRetailFacets(tx,scope,raw);
 });
}

export async function loadRetailScanPage(access:ReadAccess,raw:Partial<RetailScanQuery>,options:{cursor?:string;seek?:number;expectedScope?:string}={}){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(options.expectedScope&&options.expectedScope!==backendScopeKey(scope))throw new BackendError("登录身份或页面版本已变化，请刷新后重新核对。",409,backendIdentityChangedCode);
  return readRetailScan(tx,scope,raw,options);
 });
}
export async function loadRetailFormCandidatePage(access:ReadAccess,raw:unknown,expectedScope?:string){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(expectedScope&&expectedScope!==backendScopeKey(scope))throw new BackendError('登录身份或页面版本已变化，请刷新后重新核对。',409,backendIdentityChangedCode);
  return readRetailFormCandidates(tx,scope,raw);
 });
}
export async function loadRetailIdentityCheck(access:ReadAccess,raw:Parameters<typeof readRetailIdentityConflict>[2],expectedScope?:string){
 return withReadDatabase(access.identity,access.storeId,async tx=>{
  const member=await memberForRead(tx,access.storeId,access.identity.userId),scope=scopeFor(access,member);
  if(expectedScope&&expectedScope!==backendScopeKey(scope))throw new BackendError('登录身份或页面版本已变化，请刷新后重新核对。',409,backendIdentityChangedCode);
  const conflict=await readRetailIdentityConflict(tx,scope,raw);return{scope,items:conflict?[conflict]:[]};
 });
}
