import type { TransactionSql } from "postgres";
import { can, type StaffMember } from "../staff";
import { buildCustomerDirectory, customerCandidates, type Customer } from "../customers";
import { intakeDirectoryEntry } from "../repair-intake-record";
import { overlayRepair, workflowGroup, workflowGroups } from "../repair-workflow";
import { buildRepairPartsIndex, buildRepairListRows, selectRepairListGroups, filterRepairContactGroups, type RepairListStatusFilter, type RepairListGroupBy, type RepairListSort } from "../repair-list-model";
import { defaultRepairGroups } from "../repair-groups";
import { buildRetailListIndex, queryRetailList, retailViewFromParams } from "../retail-list-model";
import { procurementStatus, procurementStatuses, type ProcurementRecord, type RepairPartsGroup } from "../procurement";
import type { BackendSnapshot } from "./contracts";
import { emptyState } from "./command-state";
import { projectState } from "./state";
import { BackendError } from "./database";
import { referenceRetailPhotos } from "./retail-photos";
import { repairScanMatches } from "../repair-scan";
import { lookupRetailCode, retailSpec, type RetailCodeType } from "../retail";
import { buildCustomerDevices, latestCustomerDeviceTime } from "../customer-devices";
import { intakeDeviceHistory } from "../repair-intake";
import { resolveSupplierId } from "../procurement-batch";
import { procurementEventLabel } from "../procurement";

const pageSize = 50;
const summaries = new Map<string, { state: BackendSnapshot; bytes: number }>();
let cacheBytes = 0;
const maxCacheBytes = 16 * 1024 * 1024;
const batchSize = 500;
const tables = { intakes: "repair_intakes", procurement: "procurement_records", retail: "retail_units", retailHistory: "retail_history_records", customers: "customers" } as const;

// Counts/search need the entire authorized summary, never signatures, image bytes or frozen documents.
// Keyset batches bound each DB result; the revision/identity/permission key bounds cache lifetime.
async function summaryState(tx: TransactionSql, core: BackendSnapshot, member: StaffMember, domains: (keyof typeof tables)[]) {
  const key = `${core.storeId}:${core.staff.currentId}:${core.stateToken}:${domains.join(",")}:summary-v3`;
  const cached = summaries.get(key);
  if (cached) { summaries.delete(key); summaries.set(key, cached); return { ...cached.state, ...core, intakes: cached.state.intakes, workflows: cached.state.workflows, procurement: cached.state.procurement, retail: cached.state.retail, retailHistory: cached.state.retailHistory, customers: cached.state.customers }; }
  const state: BackendSnapshot = { ...core, intakes: [], signatures: [], workflows: {}, procurement: [], retail: [], retailHistory: [], customers: [] };
  for (const domain of domains) {
    if ((domain === "intakes" || domain === "procurement") && !can(member, "repairs.view") || (domain === "retail" || domain === "retailHistory") && !can(member, "retail.view") || domain === "customers" && !can(member, "customers.view")) continue;
    let cursor = "";
    while (true) {
      const rows = domain === "intakes"
        ? await tx`select id::text as cursor, data - array['policy','photos','issueNote','previewAt','retailOrigin'] as data, workflow - 'events' as workflow from chinatech_v2_private.repair_intakes where store_id=${core.storeId} and id::text>${cursor} order by id::text limit ${batchSize}`
        : domain === "retail"
          ? await tx`select id::text as cursor, (data - 'photos') || jsonb_build_object('photos','[]'::jsonb,'sales',coalesce((select jsonb_agg((sale - 'product') || jsonb_build_object('product',(sale->'product') - 'photos')) from jsonb_array_elements(data->'sales') sale),'[]'::jsonb)) as data from chinatech_v2_private.retail_units where store_id=${core.storeId} and id::text>${cursor} order by id::text limit ${batchSize}`
          : domain === "retailHistory" ? await tx`select id::text as cursor,data from chinatech_v2_private.retail_history_records where store_id=${core.storeId} and (${cursor} = '' or id > nullif(${cursor},'')::uuid) order by id limit ${batchSize}`
          : await tx`select ${tx(domain === "customers" ? "normalized_phone" : "id")}::text as cursor,data from ${tx("chinatech_v2_private."+tables[domain])} where store_id=${core.storeId} and ${tx(domain === "customers" ? "normalized_phone" : "id")}::text>${cursor} order by ${tx(domain === "customers" ? "normalized_phone" : "id")}::text limit ${batchSize}`;
      if (domain === "intakes") { state.intakes.push(...rows.map(row => row.data)); for (const row of rows) if (row.workflow) state.workflows[row.data.id] = row.workflow; }
      else if (domain === "retailHistory") state.retailHistory!.push(...rows.map(row => row.data));
      else state[domain].push(...rows.map(row => row.data));
      if (rows.length < batchSize) break;
      cursor = rows.at(-1)!.cursor;
    }
  }
  const projected = projectState(state, member);
  const bytes = Buffer.byteLength(JSON.stringify(projected));
  if (bytes <= maxCacheBytes) {
    while (summaries.size && (summaries.size >= 8 || cacheBytes + bytes > maxCacheBytes)) { const first = summaries.keys().next().value!; cacheBytes -= summaries.get(first)!.bytes; summaries.delete(first); }
    summaries.set(key, { state: projected, bytes }); cacheBytes += bytes;
  }
  return projected;
}
function pagination(total: number, requested: string | null) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize)); const value = Number(requested || "1");
  const page = Math.min(pageCount, Number.isSafeInteger(value) && value > 0 ? value : 1);
  return { page, pageCount, start: (page - 1) * pageSize };
}
function directory(state: BackendSnapshot) { return state.intakes.map(intakeDirectoryEntry).map(row => overlayRepair(row, state.workflows[row.id])); }
function customerSummary(customer: Customer): Customer { return { ...customer, repairs: [], sales: [], history: [] }; }
const procurementMatches = (row: ProcurementRecord, filter: string) => filter === "all" || (filter === "open" ? ["ordered", "partial"].includes(procurementStatus(row)) : procurementStatus(row) === filter);
export function validatePageScope(scope: string) {
  if (scope.length > 2048 || !scope.startsWith("/app/") || scope.includes("#")) throw new BackendError("页面查询无效。");
  const url = new URL(scope, "https://query.invalid");
  if (url.origin !== "https://query.invalid" || url.searchParams.get("q") && url.searchParams.get("q")!.length > 512) throw new BackendError("页面查询无效。");
  return url;
}
export async function loadPageState(tx: TransactionSql, storeId: string, member: StaffMember, scope: string): Promise<BackendSnapshot> {
  const { pathname: path, searchParams: params } = validatePageScope(scope);
  const core = projectState(await emptyState(tx, storeId, member), member);
  core.scope = scope;
  if (path === "/app/shell" || path === "/app/settings") return core;
  if(path === "/app/dashboard") {
    const data=await summaryState(tx,core,member,["intakes","procurement","retail"]);const orders=directory(data);const index=buildRepairPartsIndex(data.procurement);
    const groups:Record<string,number>=Object.fromEntries(Object.keys(workflowGroups).map(key=>[key,0]));for(const order of orders)groups[workflowGroup(order,index.get(order.id)?.records??[],data.workflows[order.id])]++;
    const recent=orders.toSorted((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).slice(0,4);
    const workflowEvents=can(member,"repairs.view")?await tx`select id,event from chinatech_v2_private.repair_intakes cross join lateral jsonb_array_elements(coalesce(workflow->'events','[]'::jsonb)) event where store_id=${storeId} order by event->>'time' desc,id,event->>'id' limit 5`:[];
    const activity=[...orders.map(order=>({id:`intake:${order.id}`,title:`${order.id} · 工单已登记`,time:order.createdAt,href:`/app/repairs/${order.id}`,tone:"violet"})),...workflowEvents.map(row=>({id:`repair:${row.id}:${row.event.id}`,title:`${row.id} · ${row.event.label}`,time:row.event.time,href:`/app/repairs/${row.id}`,tone:"mint"})),...data.procurement.flatMap(record=>record.events.map(event=>({id:`procurement:${record.id}:${event.id}`,title:`${record.item} · ${procurementEventLabel(event)}`,time:event.time,href:`/app/repairs/${record.repairId}`,tone:"amber"}))),...data.retail.flatMap(unit=>unit.events.map(event=>({id:`retail:${unit.id}:${event.id}`,title:`${unit.code} · ${event.title}`,time:event.time,href:`/app/retail/units/${unit.id}`,tone:"violet"})))].filter(row=>row.time).sort((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id)).slice(0,5);
    return {...core,directory:recent,procurement:data.procurement.filter(row=>procurementStatus(row)!=="complete").slice(0,3),views:{dashboard:{repairCount:orders.length,groups,stats:[orders.filter(row=>row.status==="diagnosis").length,groups.purchase+groups.arrival+groups.arrival_notified,orders.filter(row=>["repairing","testing"].includes(row.status)).length,orders.filter(row=>["ready","ready_notified"].includes(row.status)).length],retailCounts:Object.fromEntries(["available","inspecting","reserved"].map(key=>[key,data.retail.filter(row=>row.status===key).length])),procurementCount:data.procurement.length,activity}}};
  }
  if(path === "/app/customer-devices") {
    const data=await summaryState(tx,core,member,["intakes","retail"]);const devices=buildCustomerDevices(directory(data),data.retail);const q=(params.get("q")||"").trim().toLowerCase();const rows=devices.filter(row=>`${row.model} ${row.serial} ${row.records.map(item=>`${item.phone} ${item.id}`).join(" ")}`.toLowerCase().includes(q)).sort((a,b)=>latestCustomerDeviceTime(b).localeCompare(latestCustomerDeviceTime(a))||a.key.localeCompare(b.key));const paging=pagination(rows.length,params.get("page"));
    return {...core,views:{devices:{rows:rows.slice(paging.start,paging.start+pageSize).map(row=>({...row,records:[],recordCount:row.records.length})),total:rows.length,page:paging.page,pageCount:paging.pageCount}}};
  }
  if (path === "/app/repairs") {
    const data = await summaryState(tx, core, member, ["intakes", "procurement"]);
    const orders = directory(data);
    const rows = buildRepairListRows(orders, buildRepairPartsIndex(data.procurement), data.workflows, {});
    const result = selectRepairListGroups(rows.rows, core.settings.repairGroups ?? defaultRepairGroups(), { query: params.get("q") || "", status: (params.get("status") || "all") as RepairListStatusFilter, partsFilter: (params.get("parts") || "all") as "all" | RepairPartsGroup, groupBy: (params.get("group") || "workflow") as RepairListGroupBy, sort: (params.get("sort") || "updated") as RepairListSort });
    const contactGroups = filterRepairContactGroups(result.groups, data.workflows, Object.fromEntries(["arrival", "ready"].map(key => [key, params.get(`contact_${key}`) || "all"])));
    const groups = contactGroups.map(group => { const paging = pagination(group.rows.length, params.get(`page_${group.key}`)); return { ...group, count: group.rows.length, page: paging.page, pageCount: paging.pageCount, rows: group.rows.slice(paging.start, paging.start + pageSize) }; });
    const visible = new Set(groups.flatMap(group => group.rows.map(row => row.id)));
    return { ...core, directory: orders.filter(row => visible.has(row.id)), workflows: Object.fromEntries(Object.entries(data.workflows).filter(([id]) => visible.has(id))), procurement: data.procurement.filter(row => visible.has(row.repairId)), views: { repairs: { total: contactGroups.reduce((sum, group) => sum + group.rows.length, 0), groups } } };
  }
  const repair = /^\/app\/repairs\/([^/]+)$/.exec(path);
  if (repair && repair[1] !== "new") {
    if (!can(member, "repairs.view")) return core;
    const id = decodeURIComponent(repair[1]);
    const rows = await tx`select data, signatures, workflow from chinatech_v2_private.repair_intakes where store_id=${storeId} and id=${id}`;
    core.intakes = rows.map(row => row.data); core.signatures = rows.flatMap(row => row.signatures); core.workflows = Object.fromEntries(rows.filter(row => row.workflow).map(row => [row.data.id, row.workflow]));
    core.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and repair_id=${id} order by id`).map(row => row.data);
    return projectState(core, member);
  }
  const history = /^\/app\/retail\/history\/([^/]+)$/.exec(path);
  if (history) { if (can(member, "retail.view")) core.retailHistory = (await tx`select data from chinatech_v2_private.retail_history_records where store_id=${storeId} and id::text=${decodeURIComponent(history[1])}`).map(row => row.data); return projectState(core, member); }
  const unit = /^\/app\/retail\/units\/([^/]+)$/.exec(path);
  if (unit) {
    if (can(member, "retail.view")) core.retail = (await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} and id::text=${decodeURIComponent(unit[1])}`).map(row => referenceRetailPhotos(row.data));
    const ids = core.retail.flatMap(row => row.sales.flatMap(sale => (sale.afterSales ?? []).flatMap(item => item.repairId ? [item.repairId] : [])));
    if (can(member, "repairs.view") && ids.length) { const rows = await tx`select data,workflow from chinatech_v2_private.repair_intakes where store_id=${storeId} and id=any(${ids})`;core.intakes=rows.map(row=>row.data);core.workflows=Object.fromEntries(rows.filter(row=>row.workflow).map(row=>[row.data.id,row.workflow])); }
    return projectState(core, member);
  }
  if (path === "/app/retail" && params.get("source") !== "units") {
    const data = await summaryState(tx, core, member, ["retail", "retailHistory"]);
    const result = queryRetailList(buildRetailListIndex(data.retail, data.retailHistory ?? []), { view: retailViewFromParams(params), condition: params.get("condition") || "all", query: params.get("q") || "", category: params.get("category") || "all", review: params.get("review") === "pending", status: params.get("view") === "other" ? params.get("status") || "all" : "all", sort: params.get("sort") || "newest", page: Number(params.get("page") || 1) });
    return { ...core, views: { retail: { ...result, items: result.items.map(item => ({ ...item, search: "" })) } } };
  }
  if(path === "/app/retail" && params.get("source")==="units") {
    const data=await summaryState(tx,core,member,["retail"]);const q=(params.get("q")||"").trim().toLowerCase();const category=params.get("category")||"all";const condition=params.get("condition")||"all";const status=params.get("status")||"inhouse";const sort=params.get("sort")||"newest";
    const match=(value:string,filter:string)=>filter==="all" || (filter==="inhouse"?value!=="sold":filter==="processing"?["inspecting","hold"].includes(value):value===filter);
    const searched=data.retail.filter(row=>(category==="all" || row.category===category) && [row.code,row.serial,row.imei1,row.imei2,row.productCode,row.brand,row.model,row.color,row.location,retailSpec(row)].join(" ").toLowerCase().includes(q));
    const filtered=searched.filter(row=>match(row.status,status) && (condition==="all" || row.condition===condition)).sort((left,right)=>{if(sort.startsWith("price")){if(left.priceCents===null || right.priceCents===null)return left.priceCents===right.priceCents?left.id.localeCompare(right.id):left.priceCents===null?1:-1;return (left.priceCents-right.priceCents)*(sort==="price-asc"?1:-1)||left.id.localeCompare(right.id);}return ((left.intakeDate||"0000").localeCompare(right.intakeDate||"0000")||left.id.localeCompare(right.id))*(sort==="oldest"?1:-1);});
    const paging=pagination(filtered.length,params.get("page"));return {...core,retail:filtered.slice(paging.start,paging.start+pageSize),views:{retailManagement:{total:filtered.length,page:paging.page,pageCount:paging.pageCount,statusCounts:Object.fromEntries(["inhouse","available","reserved","processing"].map(key=>[key,searched.filter(row=>match(row.status,key) && (condition==="all" || row.condition===condition)).length])),conditionCounts:Object.fromEntries(["all","新机","翻新机"].map(key=>[key,searched.filter(row=>match(row.status,status) && (key==="all" || row.condition===key)).length]))}}};
  }
  if (path === "/app/procurement-batch") {
    if (!can(member, "repairs.view")) throw new BackendError("当前账号没有维修查看权限。", 403);
    const action = params.get("action");
    if (action !== "ordered" && action !== "arrival") throw new BackendError("批量查询类型无效。");
    const data = await summaryState(tx, core, member, ["intakes", "procurement"]);
    const supplierId = params.get("supplier");
    const eligible = data.procurement.filter(row => action === "ordered" ? procurementStatus(row) === "cart" : ["ordered", "partial"].includes(procurementStatus(row)));
    const counts:Record<string,number>={};let unresolved=0;
    for(const row of eligible){const id=resolveSupplierId(row,core.settings.suppliers);if(id)counts[id]=(counts[id]??0)+1;else unresolved++;}
    const filtered=supplierId?eligible.filter(row=>resolveSupplierId(row,core.settings.suppliers)===supplierId):[];
    const paging=pagination(filtered.length,params.get("page"));const records=filtered.slice(paging.start,paging.start+pageSize);
    const ids = new Set(records.map(row => row.repairId));
    return { ...core, directory: directory(data).filter(row => ids.has(row.id)), procurement: records,views:{procurementBatch:{total:supplierId?filtered.length:eligible.length,counts,unresolved,page:paging.page,pageCount:paging.pageCount}} };
  }
  if (path === "/app/procurement") {
    const data = await summaryState(tx, core, member, ["intakes", "procurement"]); const orders = directory(data); const byId = new Map(orders.map(row => [row.id, row]));
    const q = (params.get("q") || "").trim().toLowerCase(); const filter = params.get("filter") || "all"; const repairId = params.get("repair") || ""; const groupBy = params.get("group") || "supplier";
    const filtered = data.procurement.filter(row => procurementMatches(row, filter) && (!repairId || row.repairId === repairId) && [row.id, row.item, row.supplier, row.repairId, byId.get(row.repairId)?.device.model].join(" ").toLowerCase().includes(q));
    const groups: Record<string, number> = {}; for (const row of filtered) { const group = groupBy === "status" ? procurementStatuses[procurementStatus(row)].label : groupBy === "supplier" ? row.supplier : groupBy === "repair" ? `${row.repairId} · ${byId.get(row.repairId)?.device.model ?? "关联工单"}` : "全部条目"; groups[group] = (groups[group] || 0) + 1; }
    const paging = pagination(filtered.length, params.get("page")); const records = filtered.slice(paging.start, paging.start + pageSize);
    return { ...core, directory: orders.filter(row=>records.some(record=>record.repairId===row.id)), workflows: Object.fromEntries(Object.entries(data.workflows).filter(([id])=>records.some(record=>record.repairId===id))), procurement: records, views: { procurement: { total: filtered.length, page: paging.page, pageCount: paging.pageCount, groups, counts: Object.fromEntries(["all", "draft", "cart", "open", "complete"].map(key => [key, data.procurement.filter(row => procurementMatches(row, key)).length])) } } };
  }
  const purchase = /^\/app\/procurement\/([^/]+)$/.exec(path);
  if (purchase && purchase[1] !== "new") {
    if (!can(member, "repairs.view")) return core;
    core.procurement = (await tx`select data from chinatech_v2_private.procurement_records where store_id=${storeId} and id=${decodeURIComponent(purchase[1])}`).map(row => row.data);
    const ids = core.procurement.map(row => row.repairId); if (ids.length) { const repairs = await tx`select data,workflow from chinatech_v2_private.repair_intakes where store_id=${storeId} and id=any(${ids})`; core.intakes=repairs.map(row=>row.data);core.workflows=Object.fromEntries(repairs.filter(row=>row.workflow).map(row=>[row.data.id,row.workflow])); }
    return projectState(core, member);
  }
  const customer = /^\/app\/customers\/([^/]+)$/.exec(path);
  if (path === "/app/customers" || customer) {
    if (!can(member, "customers.view")) return core;
    const data = await summaryState(tx, core, member, ["intakes", "retail", "retailHistory", "customers"]);
    const all = buildCustomerDirectory(directory(data), data.retail, data.customers, data.intakes.map(row => ({ phone: row.phone, name: row.customerName, email: row.email })), data.retailHistory);
    const counts = Object.fromEntries(all.map(row => [row.id, { repairs: row.repairs.length, sales: row.sales.length, history: row.history.length }]));
    const q = (params.get("q") || "").trim().toLowerCase(); const digits = q.replace(/\D/g, "");
    const filtered = customer ? all.filter(row => row.id === decodeURIComponent(customer[1])) : all.filter(row => `${row.name} ${row.phone} ${row.email}`.toLowerCase().includes(q) || digits.length >= 3 && row.phone.includes(digits));
    const paging = pagination(filtered.length, params.get("page"));
    let rows = filtered.slice(paging.start, paging.start + pageSize).map(customerSummary);
    if (customer) rows = filtered.map(row => { const type = params.get("records") || (row.repairs.length ? "repairs" : row.sales.length ? "sales" : row.history.length ? "history" : "repairs"); const facts = row[type as "repairs" | "sales" | "history"] ?? row.repairs; const recordsPage = pagination(facts.length, params.get("page")); return { ...customerSummary(row), [type]: facts.slice(recordsPage.start, recordsPage.start + pageSize) }; });
    const detailPage = customer && filtered[0] ? pagination((filtered[0][(params.get("records") || (filtered[0].repairs.length ? "repairs" : filtered[0].sales.length ? "sales" : "history")) as "repairs" | "sales" | "history"] ?? []).length, params.get("page")) : paging;
    return { ...core, customers: rows.map(row => ({ phone: row.phone, name: row.name, email: row.email, note: row.note, version: row.version, updatedAt: row.updatedAt })), views: { customers: { rows, total: filtered.length, page: detailPage.page, pageCount: detailPage.pageCount, counts: Object.fromEntries(rows.map(row=>[row.id,counts[row.id]])) } } };
  }
  if(path === "/app/retail/new") {
    const copy=params.get("copy");if(copy && can(member,"retail.view"))core.retail=(await tx`select data from chinatech_v2_private.retail_units where store_id=${storeId} and id::text=${copy}`).map(row=>referenceRetailPhotos(row.data));
    return projectState(core,member);
  }
  if(path === "/app/repairs/new")return core;
  if(path === "/app/procurement/new")return core;
  throw new BackendError("页面查询不存在。",404);
}

export async function loadLookup(tx:TransactionSql,storeId:string,member:StaffMember,kind:string,query:string,origin:string,type="internal",page="1") {
  if(query.length>512)throw new BackendError("查询内容过长。");
  const core=projectState(await emptyState(tx,storeId,member),member);
  if(kind==="customer") {
    if(!can(member,"customers.view"))throw new BackendError("当前账号没有客户查看权限。",403);
    const data=await summaryState(tx,core,member,["intakes","retail","retailHistory","customers"]);
    const all=buildCustomerDirectory(directory(data),data.retail,data.customers,[],data.retailHistory);
    return {rows:customerCandidates(query,all).map(customerSummary)};
  }
  if(kind==="repair") {
    if(!can(member,"repairs.view"))throw new BackendError("当前账号没有维修查看权限。",403);
    const data=await summaryState(tx,core,member,["intakes"]);const rows=repairScanMatches(query,directory(data),origin);const paging=pagination(rows.length,page);
    return {rows:rows.slice(paging.start,paging.start+pageSize),total:rows.length,page:paging.page,pageCount:paging.pageCount};
  }
  if(kind==="deviceRecords") {
    const data=await summaryState(tx,core,member,["intakes","retail"]);const device=buildCustomerDevices(directory(data),data.retail).find(row=>row.key===query);const rows=device?.records.toSorted((a,b)=>b.time.localeCompare(a.time)||a.id.localeCompare(b.id))??[];const paging=pagination(rows.length,page);return {rows:rows.slice(paging.start,paging.start+pageSize),total:rows.length,page:paging.page,pageCount:paging.pageCount};
  }
  if(kind==="deviceHistory") {
    if(!can(member,"repairs.view"))throw new BackendError("当前账号没有维修查看权限。",403);
    const parsed=JSON.parse(query);if(!Array.isArray(parsed)||parsed.length!==3||parsed.some(value=>typeof value!=="string" || value.length>150))throw new BackendError("设备查询无效。");
    const data=await summaryState(tx,core,member,["intakes"]);const history=intakeDeviceHistory(parsed[0],parsed[1],parsed[2],directory(data));
    const paging=pagination(history.exact.length,page);return {rows:[...history.exact.slice(paging.start,paging.start+50).map(row=>({...row,bucket:"exact"})),...history.related.slice(0,3).map(row=>({...row,bucket:"related"}))],total:history.exact.length,exact:history.exact.length,related:history.related.length,page:paging.page,pageCount:paging.pageCount};
  }
  if(kind==="repairOptions") {
    if(!can(member,"repairs.view"))throw new BackendError("当前账号没有维修查看权限。",403);
    const data=await summaryState(tx,core,member,["intakes"]);const q=query.trim().toLowerCase();const rows=directory(data).filter(row=>[row.id,row.device.model,row.customer.name,row.customer.phone].join(" ").toLowerCase().includes(q));return {rows:rows.slice(0,50),total:rows.length};
  }
  if(kind==="retail") {
    if(!can(member,"retail.view"))throw new BackendError("当前账号没有整机查看权限。",403);
    if(!["internal","serial","imei","product"].includes(type))throw new BackendError("码类型无效。");
    const data=await summaryState(tx,core,member,["retail"]);const rows=lookupRetailCode(data.retail,query,type as RetailCodeType);const paging=pagination(rows.length,page);
    return {rows:rows.slice(paging.start,paging.start+pageSize).map(row=>({id:row.id,code:row.code,brand:row.brand,model:row.model,status:row.status})),total:rows.length,page:paging.page,pageCount:paging.pageCount};
  }
  throw new BackendError("查询类型无效。");
}
