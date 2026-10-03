"use client";
import { SearchCombobox } from "@/components/search-combobox";
import { useBackendLookup } from "@/components/backend-lookup";
import { usePageQuery, QueryNotice, PageControls } from "@/components/backend-query";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useState } from "react";
import { ChevronRight, PackageSearch, Plus, Search } from "lucide-react";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivedQuantity, procurementStatus, procurementStatuses, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "@/components/backend-domain-context";
import { SupplierBatchDialog } from "./supplier-batch-dialog";
import { useStaff } from "@/components/staff/use-staff";

type Filter = "all" | "draft" | "cart" | "open" | "complete";
const filters: { value: Filter; label: string }[] = [{ value: "all", label: "全部采购" }, { value: "draft", label: "待选配件" }, { value: "cart", label: "已加购物车" }, { value: "open", label: "等待到齐" }, { value: "complete", label: "已到齐" }];
const matchesStatus = (record: ProcurementRecord, filter: Filter) => filter === "all" || (filter === "open" ? ["ordered", "partial"].includes(procurementStatus(record)) : procurementStatus(record) === filter);

export function ProcurementList({ initialRepairId = "" }: { initialRepairId?: string }) {
  const [batchAction, setBatchAction] = useState<"ordered"|"arrival"|null>(null);
  const staff = useStaff(); const canEdit = staff.can("repairs.edit");
  const { records, listView, dispatch } = useProcurement();
  const repairOrders = useRepairDirectory();
  const getRepairOrder = (id: string) => repairOrders.find(repair => repair.id === id);
  const params=useSearchParams();
  const [query, setQuery] = useState(params.get("q")??listView.query);
  const [filter, setFilter] = useState<Filter>((params.get("filter")??listView.filter) as Filter);
  const [repairId, setRepairId] = useState(initialRepairId || listView.repairId);
  const candidates=useBackendLookup<(typeof repairOrders)[number]>("repairOptions",repairId);
  const [groupBy, setGroupBy] = useState(params.get("group")??listView.groupBy);
  const rememberView = () => dispatch({ type: "list-view", view: { query, filter, repairId, groupBy } });
  const localFiltered = records.filter((record) => matchesStatus(record, filter) && (!repairId || record.repairId === repairId) && [record.id, record.item, record.supplier, record.repairId, getRepairOrder(record.repairId)?.device.model].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const [pageState,setPageState]=useState({key:JSON.stringify([query,filter,repairId,groupBy]),page:Number(params.get("page")||1)});const filterKey=JSON.stringify([query,filter,repairId,groupBy]);const page=pageState.key===filterKey?pageState.page:1;
  const qp=new URLSearchParams();if(query)qp.set("q",query);if(filter!=="all")qp.set("filter",filter);if(repairId)qp.set("repair",repairId);if(groupBy!=="supplier")qp.set("group",groupBy);if(page>1)qp.set("page",String(page));
  const serverQuery=usePageQuery(`/app/procurement${qp.size?`?${qp}`:""}`);const remote=serverQuery.state?.views?.procurement;const filtered=remote?records:localFiltered;
  const groups = new Map<string, ProcurementRecord[]>();
  filtered.forEach((record) => {
    const group = groupBy === "status" ? procurementStatuses[procurementStatus(record)].label : groupBy === "supplier" ? record.supplier : groupBy === "repair" ? `${record.repairId} · ${getRepairOrder(record.repairId)?.device.model ?? "关联工单"}` : "全部条目";
    groups.set(group, [...(groups.get(group) ?? []), record]);
  });
  const clearFilters = () => { setQuery(""); setFilter("all"); setRepairId(""); };

  return <main className="module-page procurement-page">
    <header className="module-heading"><PageTitle title="采购与到货" /><div className="module-heading__actions">{canEdit ? <><button className="button button--secondary" type="button" onClick={() => setBatchAction("ordered")}>采购车</button><button className="button button--secondary" type="button" onClick={() => setBatchAction("arrival")}>批量到货</button></> : null}{canEdit ? <Link className="button button--primary button--compact" onClick={rememberView} href={`/app/procurement/new${repairId ? `?repair=${encodeURIComponent(repairId)}` : ""}`}><Plus size={17} />新建采购</Link> : null}</div></header>
    {batchAction && canEdit ? <SupplierBatchDialog key={`${staff.member?.id}:${staff.member?.revision}:${batchAction}`} action={batchAction} onClose={() => setBatchAction(null)} /> : null}
    <section className="procurement-stats" aria-label="采购状态筛选">{filters.map((option) => <button type="button" aria-pressed={filter === option.value} className={`repair-status-card${filter === option.value ? " repair-status-card--active" : ""}`} onClick={() => setFilter(option.value)} key={option.value}><span>{option.label}</span><strong>{remote?.counts[option.value]??records.filter((record) => matchesStatus(record, option.value)).length}</strong><small>{option.value === "open" ? "包含部分到货" : "采购条目"}</small></button>)}</section>
    <QueryNotice query={serverQuery}/><section className="panel">
      <div className="procurement-filterbar"><label className="module-search"><Search size={18} /><input aria-label="搜索采购" placeholder="配件、采购号、供应商或工单" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{candidates.backend?<SearchCombobox label="关联工单筛选" value={repairId} onChange={setRepairId} filterOptions={false} options={candidates.rows.map(row=>({value:row.id,label:row.id,detail:row.device.model}))} placeholder="全部工单，或输入编号"/>:<label className="module-select"><SelectControl aria-label="关联工单筛选" value={repairOrders.some(repair => repair.id === repairId) ? repairId : ""} onChange={(event) => setRepairId(event.target.value)}><option value="">全部工单</option>{repairOrders.map((repair) => <option value={repair.id} key={repair.id}>{repair.id}</option>)}</SelectControl></label>}<label className="module-select"><SelectControl aria-label="采购分组" value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="status">按采购状态</option><option value="supplier">按供应商</option><option value="repair">按工单</option><option value="none">不分组</option></SelectControl></label></div>
      <div className="procurement-result-count"><span>{remote?.total??filtered.length} 条采购 · {remote?Object.keys(remote.groups).length:groups.size} 组</span>{query || repairId || filter !== "all" ? <button type="button" onClick={clearFilters}>清除筛选</button> : null}</div>
      {Array.from(groups, ([group, rows]) => <section key={group} className="procurement-group"><h3>{group}<small>{remote?.groups[group]??rows.length} 条</small></h3><div className="module-table-scroll" role="region" aria-label={`${group}采购表格`} tabIndex={0}><div className="procurement-table-head" aria-hidden="true"><span>配件 / 采购编号</span><span>关联工单</span><span>到货进度</span><span>预计到货</span><span /></div>{rows.map((record) => {
        const arrived = arrivedQuantity(record);
        const status = procurementStatuses[procurementStatus(record)];
        return <Link className="procurement-row" onClick={rememberView} href={`/app/procurement/${record.id}`} key={record.id}><div className="procurement-row__item"><span className="procurement-icon"><PackageSearch size={18} /></span><div><strong>{record.item}</strong><small>{record.id}</small></div></div><div className="procurement-row__repair"><strong>{getRepairOrder(record.repairId)?.device.model}</strong><small>{record.repairId}</small></div><div className="procurement-row__progress"><span className={`status-pill status-pill--${status.tone}`}>{status.label}</span><small>{arrived} / {record.quantity} 件</small></div><div className="procurement-row__date"><strong>{record.expectedAt || "待确认"}</strong><small>预计到货</small></div><ChevronRight size={17} /></Link>;
      })}</div></section>)}
      {!filtered.length ? <div className="module-empty"><PackageSearch size={28} /><strong>没有符合条件的采购</strong><p>调整搜索或筛选条件，或者建立关联工单的采购草稿。</p><button type="button" onClick={clearFilters}>清除筛选</button></div> : null}
    {remote?<PageControls page={remote.page} pageCount={remote.pageCount} onPage={page=>setPageState({key:filterKey,page})}/>:null}</section>
  </main>;
}
