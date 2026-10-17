import "server-only";
import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { BackendError } from "./database";
import { backendScopeKey, type BackendReadScope } from "./read-plan";
import {listSearchNeedle} from "./list-search";
import { customerReadVersionChangedCode, customerCursor, customerListQuery, type CustomerListPage, type CustomerListQuery, type CustomerListSummary } from "./customer-list-contract";

export async function customerModelGeneration(tx: TransactionSql, storeId: string) {
  const [model] = await tx`select ready,generation::text from chinatech_v2_private.customer_directory_models where store_id=${storeId} and format_version=1`;
  if (!model?.ready) throw new BackendError("后台资料暂不可用。", 503);
  return String(model.generation);
}
export function customerListToken(scope: BackendReadScope, generation: string, query: CustomerListQuery) {
  return createHash("sha256").update(JSON.stringify([1, backendScopeKey(scope), generation, query])).digest("hex");
}
export async function readCustomerList(tx: TransactionSql, scope: BackendReadScope, q = "", cursor?: string, generation?: string, mode: CustomerListQuery["mode"] = "directory", anchor?: string, seek?: number): Promise<CustomerListPage> {
  if (!scope.permissions.includes("customers.view")) throw new BackendError("当前账号没有此操作权限。", 403);
  const query = customerListQuery(q,mode), current = generation ?? await customerModelGeneration(tx, scope.storeId);
  const stateToken = customerListToken(scope, current, query);
  if (anchor && (!/^\+[1-9]\d{6,14}$/.test(anchor) || cursor)) throw new BackendError("请求资料无效。",400);
  if (seek !== undefined && (!Number.isSafeInteger(seek) || seek < 0 || seek > 1000000 || cursor || anchor)) throw new BackendError("请求资料无效。",400);
  let after: { activity: string; phone: string; direction: "before"|"after" } | null = null;
  if (cursor) {
    try {
      if (cursor.length > 2048) throw new Error();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!Array.isArray(value) || value.length !== 4 || typeof value[0] !== "string" || typeof value[1] !== "string" || typeof value[2] !== "string" || value[1].length > 100 || !["before","after"].includes(value[3]) || !/^\+[1-9]\d{6,14}$/.test(value[2])) throw new Error();
      if (value[0] !== stateToken) throw new BackendError("资料已更新，请刷新后重试。", 409, customerReadVersionChangedCode);
      after = { activity: value[1], phone: value[2], direction: value[3] };
    } catch (error) { if (error instanceof BackendError) throw error; throw new BackendError("请求资料无效。", 400); }
  }
  const rows = await customerDirectorySql(tx,scope,query,after,false,anchor,seek);
  const row = rows[0], values: { phone: string; name: string; email: string; repairs: number; sales: number; history: number; activity: string }[] = row.items;
  if (after && !row.point_found) throw new BackendError("请求资料无效。",400);
  const limit=query.mode === "directory" ? 50 : query.mode === "exact" ? 1 : 12;
  const selected=after?.direction==="before"?values.slice(-limit):values.slice(0,limit);
  const items: CustomerListSummary[] = selected.map(item => ({ id: "PHONE-"+item.phone.slice(1), phone: item.phone, name: item.name, email: item.email, repairCount: item.repairs, saleCount: item.sales, historyCount: item.history, lastActivity: item.activity }));
  const last = items.at(-1), first = items[0];
  const rank=Number(row.point_rank), startIndex=after ? after.direction === "before" ? Math.max(0,rank-items.length) : rank+1 : (anchor || seek !== undefined) && row.point_found ? rank : 0;
  return { formatVersion: 1, scope, generation: current, query, total: Number(row.total), items, stateToken,
    startIndex, previousCursor: startIndex > 0 && first ? customerCursor(stateToken,first,"before") : null, nextCursor: startIndex+items.length < Number(row.total) && last ? customerCursor(stateToken,last,"after") : null };
}

// The verification path uses this exact query, including RLS, aggregation,
// full-range count, filters and cursor; EXPLAIN never substitutes a simpler scan.
export function customerDirectorySql(tx: TransactionSql, scope: BackendReadScope, query: CustomerListQuery, after: {activity:string;phone:string;direction:"before"|"after"}|null = null, explain = false, anchor?: string, seek?: number) {
  // Facts already carry only customer display fields. Existing per-domain RLS
  // removes repair/sale/history sources before aggregation for this member.
  const needle = listSearchNeedle(query.q,query.mode!=="directory"), digits = needle.replace(/\D/g, "");
  const explicitPhone = needle.startsWith("+") || needle.startsWith("00"), phoneNeedle = needle.startsWith("00") ? digits.slice(2) : digits;
  const limit = query.mode === "directory" ? 50 : query.mode === "exact" ? 1 : 12;
  const hasPoint=Boolean(anchor)||seek!==undefined;
  const reverse=after?.direction==="before";
  const order=reverse?tx`activity collate "C" asc,phone collate "C" desc`:tx`activity collate "C" desc,phone collate "C" asc`;
  const explanation = explain ? tx`explain (analyze,buffers,format json)` : tx``;
  return tx`${explanation} with grouped as (
    select phone,
      coalesce((array_agg(name order by origin_id collate "C") filter(where origin_kind='profile'))[1],
        (array_agg(name order by case origin_kind when 'sale' then 3 when 'repair' then 2 else 1 end desc,event_at collate "C" desc,case when origin_kind='history' then event_order else 0 end desc,origin_id collate "C" desc,event_order desc,event_id collate "C" desc) filter(where origin_kind<>'profile' and name<>''))[1],'') as name,
      coalesce((array_agg(email order by origin_id collate "C") filter(where origin_kind='profile'))[1],
        (array_agg(email order by case origin_kind when 'sale' then 2 else 1 end desc,case when origin_kind='sale' then event_at else origin_id end collate "C" desc,origin_id collate "C" desc,event_order desc,event_id collate "C" desc) filter(where origin_kind in ('sale','repair') and email<>''))[1],'') as email,
      count(*) filter(where origin_kind='repair')::integer as repairs,
      count(*) filter(where origin_kind='sale')::integer as sales,
      count(*) filter(where origin_kind='history')::integer as history,
      max(activity_at collate "C") as activity
    from chinatech_v2_private.customer_directory_sources where store_id=${scope.storeId} group by phone
  ), filtered as (
    select * from grouped where
      (${query.mode}='directory' and (${needle}='' or strpos(lower(name||' '||phone||' '||email),${needle})>0 or (length(${digits})>=3 and strpos(phone,${digits})>0)))
      or (${query.mode}='phone' and length(${digits})>=3 and chinatech_v2_private.directory_phone_query(${needle}) and (case when ${explicitPhone} then starts_with(substr(phone,2),${phoneNeedle}) else strpos(substr(phone,2),${phoneNeedle})>0 end))
      or (${query.mode}='exact' and phone=chinatech_v2_private.directory_phone(${needle}))
  ), point as (
    select activity,phone from filtered where (${seek!==undefined} or phone=${after?.phone??anchor??""}) and (${after===null} or activity=${after?.activity??""})
    order by activity collate "C" desc,phone collate "C" asc offset greatest(0,least(${seek??0},(select count(*)-1 from filtered))) limit 1
  ), page as (
    select * from filtered where
     (${after===null} and ${!hasPoint}) or (${after===null} and not exists(select 1 from point))
     or (${!reverse} and (activity collate "C" < (select activity from point) collate "C" or activity=(select activity from point) and (case when ${after!==null} then phone collate "C"> (select phone from point) collate "C" else phone collate "C">=(select phone from point) collate "C" end)))
     or (${reverse} and (activity collate "C">(select activity from point) collate "C" or activity=(select activity from point) and phone collate "C"<(select phone from point) collate "C"))
    order by ${order} limit ${limit+1}
  ) select (select count(*)::integer from filtered) as total,
    exists(select 1 from point) as point_found,
    (select count(*)::integer from filtered where activity collate "C">(select activity from point) collate "C" or activity=(select activity from point) and phone collate "C"<(select phone from point) collate "C") as point_rank,
    coalesce((select jsonb_agg(to_jsonb(page) order by activity collate "C" desc,phone collate "C" asc) from page),'[]'::jsonb) as items`;
}
