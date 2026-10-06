"use client";

import { useLanguage } from "@/components/language-provider";
import { repairItemText } from "@/lib/i18n/repair-display";
import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useState } from "react";
import { ChevronRight, PackageSearch, Plus, Search } from "lucide-react";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { arrivedQuantity, procurementStatus, procurementStatuses, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { SupplierBatchDialog } from "./supplier-batch-dialog";
import { useStaff } from "@/components/staff/use-staff";

type Filter = "all" | "draft" | "cart" | "open" | "complete";
const filters: { value: Filter; label: string }[] = [{ value: "all", label: "全部采购" }, { value: "draft", label: "待选配件" }, { value: "cart", label: "已加购物车" }, { value: "open", label: "等待到齐" }, { value: "complete", label: "已到齐" }];
const matchesStatus = (record: ProcurementRecord, filter: Filter) => filter === "all" || (filter === "open" ? ["ordered", "partial"].includes(procurementStatus(record)) : procurementStatus(record) === filter);

export function ProcurementList({ initialRepairId = "" }: { initialRepairId?: string }) {
  const { t, locale } = useLanguage();
  const [batchAction, setBatchAction] = useState<"ordered"|"arrival"|null>(null);
  const staff = useStaff(); const canEdit = staff.can("repairs.edit");
  const { records, listView, dispatch } = useProcurement();
  const repairOrders = useRepairDirectory();
  const getRepairOrder = (id: string) => repairOrders.find(repair => repair.id === id);
  const [query, setQuery] = useState(listView.query);
  const [filter, setFilter] = useState<Filter>(listView.filter);
  const [repairId, setRepairId] = useState(initialRepairId || listView.repairId);
  const [groupBy, setGroupBy] = useState(listView.groupBy);
  const rememberView = () => dispatch({ type: "list-view", view: { query, filter, repairId, groupBy } });
  const filtered = records.filter((record) => matchesStatus(record, filter) && (!repairId || record.repairId === repairId) && [record.id, record.item, record.supplier, record.repairId, getRepairOrder(record.repairId)?.device.model].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const groups = new Map<string, ProcurementRecord[]>();
  filtered.forEach((record) => {
    const group = groupBy === "status" ? t(procurementStatuses[procurementStatus(record)].label) : groupBy === "supplier" ? record.supplier : groupBy === "repair" ? `${record.repairId} · ${getRepairOrder(record.repairId)?.device.model ?? t("关联工单")}` : t("全部条目");
    groups.set(group, [...(groups.get(group) ?? []), record]);
  });
  const clearFilters = () => { setQuery(""); setFilter("all"); setRepairId(""); };

  return <main className="module-page procurement-page">
    <header className="module-heading"><PageTitle title={t("采购与到货")} /><div className="module-heading__actions">{canEdit ? <><button className="button button--secondary" type="button" onClick={() => setBatchAction("ordered")}>{t("采购车")}</button><button className="button button--secondary" type="button" onClick={() => setBatchAction("arrival")}>{t("批量到货")}</button></> : null}{canEdit ? <Link className="button button--primary button--compact" onClick={rememberView} href={`/app/procurement/new${repairId ? `?repair=${encodeURIComponent(repairId)}` : ""}`}><Plus size={17} />{t("新建采购")}</Link> : null}</div></header>
    {batchAction && canEdit ? <SupplierBatchDialog key={`${staff.member?.id}:${staff.member?.revision}:${batchAction}`} action={batchAction} onClose={() => setBatchAction(null)} /> : null}
    <section className="procurement-stats" aria-label={t("采购状态筛选")}>{filters.map((option) => <button type="button" aria-pressed={filter === option.value} className={`repair-status-card${filter === option.value ? " repair-status-card--active" : ""}`} onClick={() => setFilter(option.value)} key={option.value}><span>{t(option.label)}</span><strong>{records.filter((record) => matchesStatus(record, option.value)).length}</strong><small>{option.value === "open" ? t("包含部分到货") : t("采购条目")}</small></button>)}</section>
    <section className="panel">
      <div className="procurement-filterbar"><label className="module-search"><Search size={18} /><InputControl onClear={() => setQuery("")} clearLabel={t("清空搜索采购")} aria-label={t("搜索采购")} placeholder={t("配件、采购号、供应商或工单")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="module-select"><SelectControl aria-label={t("关联工单筛选")} value={repairOrders.some(repair => repair.id === repairId) ? repairId : ""} onChange={(event) => setRepairId(event.target.value)}><option value="">{t("全部工单")}</option>{repairOrders.map((repair) => <option value={repair.id} key={repair.id}>{repair.id}</option>)}</SelectControl></label><label className="module-select"><SelectControl aria-label={t("采购分组")} value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="status">{t("按采购状态")}</option><option value="supplier">{t("按供应商")}</option><option value="repair">{t("按工单")}</option><option value="none">{t("不分组")}</option></SelectControl></label></div>
      <div className="procurement-result-count"><span>{filtered.length} {t(" 条采购 · ")}{groups.size} {t(" 组")}</span>{query || repairId || filter !== "all" ? <button type="button" onClick={clearFilters}>{t("清除筛选")}</button> : null}</div>
      {Array.from(groups, ([group, rows]) => <section key={group} className="procurement-group"><h3>{group}<small>{rows.length} {t(" 条")}</small></h3><div className="module-table-scroll" role="region" aria-label={t("{v0}采购表格", { v0: group })} tabIndex={0}><div className="procurement-table-head" aria-hidden="true"><span>{t("配件 / 采购编号")}</span><span>{t("关联工单")}</span><span>{t("到货进度")}</span><span>{t("预计到货")}</span><span /></div>{rows.map((record) => {
        const arrived = arrivedQuantity(record);
        const status = procurementStatuses[procurementStatus(record)];
        return <Link className="procurement-row" onClick={rememberView} href={`/app/procurement/${record.id}`} key={record.id}><div className="procurement-row__item"><span className="procurement-icon"><PackageSearch size={18} /></span><div><strong>{repairItemText(record.item, locale)}</strong><small>{record.id}</small></div></div><div className="procurement-row__repair"><strong>{getRepairOrder(record.repairId)?.device.model}</strong><small>{record.repairId}</small></div><div className="procurement-row__progress"><span className={`status-pill status-pill--${status.tone}`}>{t(status.label)}</span><small>{arrived} / {record.quantity} {t(" 件")}</small></div><div className="procurement-row__date"><strong>{record.expectedAt || t("待确认")}</strong><small>{t("预计到货")}</small></div><ChevronRight size={17} /></Link>;
      })}</div></section>)}
      {!filtered.length ? <div className="module-empty"><PackageSearch size={28} /><strong>{t("没有符合条件的采购")}</strong><p>{t("调整搜索或筛选条件，或者建立关联工单的采购草稿。")}</p><button type="button" onClick={clearFilters}>{t("清除筛选")}</button></div> : null}
    </section>
  </main>;
}
