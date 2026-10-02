"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpDown, ChevronsDownUp, ChevronsUpDown, ChevronRight, CircleHelp,
  ClipboardList, Clock3, Flag, Gamepad2, Laptop, ListFilter, SlidersHorizontal, RotateCcw,
  PackageCheck, PackageOpen, PackageSearch, Plus, Search, ShoppingCart,
  Smartphone, Tablet, Truck, X, CheckCircle2,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { RepairProcurementDialog, RepairProcurementShortcut } from "@/components/procurement/repair-procurement-shortcut";
import { repairPartsSummary, type RepairPartsGroup } from "@/lib/procurement";
import { compareRepairUpdates, repairUpdatedAt } from "@/lib/repair-list-order";
import { initialRepairWorkflow, workflowGroup } from "@/lib/repair-workflow";
import { RepairStageControl } from "./repair-stage-control";
import { useRepairWorkflows } from "./repair-workflow-store";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { useRepairDirectory } from "./local-intake-store";
import { RepairScanner } from "./repair-scanner";

import { useStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, type RepairGroupKind } from "@/lib/repair-groups";
import { RepairGroupEditor } from "./repair-group-editor";

type StatusFilter = "all" | "including_cancelled" | RepairStatus;

const groupVisuals = {
  draft: { icon: PackageSearch, tone: "warning" },
  cart: { icon: ShoppingCart, tone: "info" },
  mixed: { icon: ClipboardList, tone: "warning" },
  ordered: { icon: Truck, tone: "info" },
  complete: { icon: PackageCheck, tone: "success" },
  unrecorded: { icon: CircleHelp, tone: "neutral" },
} as const;
const deviceIcons = { 手机: Smartphone, 电脑: Laptop, 平板: Tablet, 游戏机: Gamepad2 };

function TableHead() {
  return <div className="repair-module-table__head" aria-hidden="true"><span>工单 / 设备</span><span>客户</span><span>供应商 / 配件</span><span>配件进度</span><span>负责人 / 更新</span><span>维修阶段</span><span>快捷操作</span></div>;
}

export function RepairList() {
  const staff = useStaff();
  const canEdit = staff.can("repairs.edit");
  const canManageGroups = staff.can("settings.edit");
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const groupSettings = settings.repairGroups ?? defaultRepairGroups();
  const [editingGroups, setEditingGroups] = useState<RepairGroupKind | null>(null);
  const [groupFeedback, setGroupFeedback] = useState("");
  function closeGroupEditor() { setEditingGroups(null); requestAnimationFrame(() => document.getElementById("manage-repair-groups")?.focus()); }
  const repairOrders = useRepairDirectory();
  const { workflows, error: workflowError } = useRepairWorkflows();
  const { records, feedback, dispatch, repairUpdates, storageError } = useProcurement();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [partsFilter, setPartsFilter] = useState<"all" | RepairPartsGroup>("all");
  const [groupBy, setGroupBy] = useState("workflow");
  const [sort, setSort] = useState("updated");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [activeRepairId, setActiveRepairId] = useState<string | null>(null);

  const summaries = new Map(repairOrders.map((repair) => [repair.id, repairPartsSummary(records, repair.id)]));
  const filteredRepairs = repairOrders.filter((repair) => {
    const searchable = [repair.id, repair.customer.name, repair.customer.phone, repair.device.brand, repair.device.model, repair.device.serial, repair.issue].join(" ").toLocaleLowerCase();
    return (status === "including_cancelled" || (status === "all" ? repair.status !== "cancelled" : repair.status === status))
      && (partsFilter === "all" || summaries.get(repair.id)!.group === partsFilter)
      && searchable.includes(query.trim().toLocaleLowerCase());
  }).sort((left, right) => {
    if (sort === "created") return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
    if (sort === "priority") {
      const priorityScore = { 紧急: 0, 优先: 1, 普通: 2 };
      const priority = priorityScore[left.priority] - priorityScore[right.priority];
      if (priority) return priority;
    }
    return compareRepairUpdates(left, right, repairUpdates);
  });
  const groups = groupBy === "parts"
    ? groupSettings.parts.map(({key, label}) => ({ key, label, rows: filteredRepairs.filter((repair) => summaries.get(repair.id)!.group === key) }))
    : groupBy === "workflow" ? groupSettings.workflow.filter(({key}) => key !== "cancelled" || status === "including_cancelled" || status === "cancelled").map(({key, label}) => ({ key, label, rows: filteredRepairs.filter(order => workflowGroup(order, records, workflows[order.id]) === key) }))
    : [{ key: "all", label: "全部工单", rows: filteredRepairs }];
  const clearFilters = () => { setQuery(""); setStatus("all"); setPartsFilter("all"); };
  const setAllGroups = (open: boolean) => setOpenGroups(Object.fromEntries(groups.map((group) => [group.key, open])));

  function closeShortcut() {
    const id = activeRepairId;
    setActiveRepairId(null);
    if (!id) return;
    const order = repairOrders.find(order => order.id === id);
    const group = groupBy === "none" ? "all" : groupBy === "workflow" && order ? workflowGroup(order, records, workflows[id]) : summaries.get(id)?.group ?? "all";
    setOpenGroups((previous) => ({ ...previous, [group]: true }));
    requestAnimationFrame(() => {
      const target = document.getElementById(`repair-action-${id}`) ?? document.getElementById(`repair-group-${group}`) ?? document.getElementById("repair-search");
      target?.focus();
    });
  }

  return <main className="module-page repair-page repair-parts-list repair-unified-list">
    <header className="module-heading"><PageTitle title="维修工单" /><div className="module-heading__actions"><RepairScanner />{canEdit ? <Link className="button button--primary button--compact" href="/app/repairs/new"><Plus size={17} />新建工单</Link> : null}</div></header>
    <section className="panel repair-module-panel">
      <div className="repair-filterbar">
        <button type="button" className="button button--secondary repair-mobile-filter" aria-expanded={filtersOpen} aria-controls="repair-filter-options" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={18} /><span>筛选{status !== "all" || partsFilter !== "all" ? " · 已选" : ""}</span></button>
        <label className="module-search"><Search size={18} /><input id="repair-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工单、客户、设备" aria-label="搜索维修工单" />{query ? <button type="button" onClick={() => setQuery("")}>清除</button> : null}</label>
        <div id="repair-filter-options" className={`repair-filter-options${filtersOpen ? " repair-filter-options--open" : ""}`}><label className="module-select"><SelectControl aria-label="维修阶段筛选" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">全部阶段（不含作废）</option><option value="including_cancelled">全部阶段（含作废）</option>{repairStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</SelectControl></label>
        <label className="module-select"><SelectControl aria-label="配件状态筛选" value={partsFilter} onChange={(event) => setPartsFilter(event.target.value as "all" | RepairPartsGroup)}><option value="all">全部配件状态</option>{groupSettings.parts.map(({key, label}) => <option value={key} key={key}>{label}</option>)}</SelectControl></label>
        <label className="module-select"><SelectControl aria-label="工单分组" value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="workflow">按维修状态分组</option><option value="parts">按配件分组</option><option value="none">不分组</option></SelectControl></label>
        <label className="module-select"><ArrowUpDown size={17} /><SelectControl value={sort} onChange={(event) => setSort(event.target.value)} aria-label="工单排序"><option value="updated">更新 → 建单：旧 → 新</option><option value="created">建单：旧 → 新</option><option value="priority">优先级</option></SelectControl></label>
        <button className="button button--secondary button--tiny repair-filter-reset" type="button" onClick={clearFilters}><RotateCcw size={15} />重置筛选</button></div>
        <div className="repair-group-tools"><span className="filter-count"><ListFilter size={15} aria-hidden="true" />{filteredRepairs.length} 单</span>{groupBy !== "none" ? <>{canManageGroups ? <button id="manage-repair-groups" className="button button--secondary button--compact" type="button" disabled={!settingsReady || Boolean(settingsError)} onClick={() => { setGroupFeedback(""); setEditingGroups(groupBy as RepairGroupKind); }}>管理分组</button> : null}<button className="icon-button" type="button" title="展开全部" aria-label="展开全部分组" disabled={!groups.length || groups.every((group) => openGroups[group.key])} onClick={() => setAllGroups(true)}><ChevronsUpDown size={18} /></button><button className="icon-button" type="button" title="收起全部" aria-label="收起全部分组" disabled={!groups.some((group) => openGroups[group.key])} onClick={() => setAllGroups(false)}><ChevronsDownUp size={18} /></button></> : null}</div>
      </div>
      {storageError || workflowError || settingsError ? <p className="form-error" role="alert">{storageError || workflowError || settingsError}</p> : null}
      {groupFeedback ? <p role="status" className="section-empty">{groupFeedback}</p> : null}
      <div className="module-table-scroll" role="region" aria-label="工单表格" tabIndex={0}>
        {groups.map((group) => {
          const grouped = group.key !== "all";
          const visual = grouped && groupBy === "parts" ? groupVisuals[group.key as RepairPartsGroup] : grouped ? { icon: ClipboardList, tone: (["complete", "ready", "ready_notified"].includes(group.key) ? "success" : ["cancelled", "awaiting_reply", "collected_unpaid"].includes(group.key) ? "warning" : "info") } : null;
          const GroupIcon = visual?.icon;
          const expanded = !grouped || Boolean(openGroups[group.key]);
          return <section className={`repair-parts-group${visual ? ` repair-parts-group--${visual.tone}` : ""}${expanded ? " repair-parts-group--expanded" : ""}`} key={group.key} aria-label={group.label}>
            {grouped ? <h3><button id={`repair-group-${group.key}`} className="repair-group-toggle" type="button" aria-expanded={expanded} aria-controls={`repair-group-rows-${group.key}`} onClick={() => setOpenGroups((previous) => ({ ...previous, [group.key]: !previous[group.key] }))}><ChevronRight className="repair-group-chevron" size={17} aria-hidden="true" />{GroupIcon ? <GroupIcon className="repair-group-icon" size={18} aria-hidden="true" /> : null}<span>{group.label}</span><small>{group.rows.length}</small></button></h3> : null}
            <div id={`repair-group-rows-${group.key}`} className="repair-module-list" hidden={!expanded}>
              {group.rows.length ? <TableHead /> : <div className="section-empty">暂无符合条件的工单</div>}
              {group.rows.map((repair) => {
                const summary = summaries.get(repair.id)!;
                const DeviceIcon = deviceIcons[repair.device.category as keyof typeof deviceIcons] ?? CircleHelp;
                const parts = records.filter(row => row.repairId === repair.id);
                const suppliers = [...new Set(parts.map(row => row.supplier))].join("、");
                const updated = repairUpdatedAt(repair, repairUpdates);
                return <article className="repair-module-row" key={repair.id} aria-label={`${repair.id} ${repair.device.model}`}>
                  <div className="repair-module-row__device"><span className="device-glyph" title={repair.device.category}><DeviceIcon size={20} aria-hidden="true" /></span><div><Link className="repair-row-link" href={`/app/repairs/${repair.id}`} aria-label={`打开 ${repair.id} ${repair.device.model} 详情`} title={`${repair.device.model} · ${repair.issue}`}><strong>{repair.device.model}</strong></Link><small>{repair.id}</small></div></div>
                  <div className="repair-module-row__cell repair-module-row__customer"><strong>{repair.customer.name}</strong><small>{repair.customer.phone}</small></div>
                  <button className="repair-row-parts" type="button" onClick={() => setActiveRepairId(repair.id)} aria-label={`${repair.id} 供应商与配件${canEdit ? "操作" : "详情"}`} title={parts.map(row => `${row.supplier} · ${row.item}`).join("\n") || (canEdit ? "添加配件" : "尚未登记配件")}><strong>{suppliers || (canEdit ? "选择供应商 / 配件" : "尚未登记配件")}</strong><small>{parts.length ? `${parts[0].item}${parts.length > 1 ? ` +${parts.length - 1}` : ""}` : "尚未登记"}</small></button>
                  <div className="repair-module-row__cell repair-module-row__waiting">
                    {groupBy !== "parts" ? <strong>{summary.label}</strong> : null}
                    {summary.total ? <div className="repair-parts-counts"><span title={`已加购物车 ${summary.inCart}/${summary.total} 件，仍未下单`}><ShoppingCart size={15} aria-hidden="true" /><span>加车 {summary.inCart}/{summary.total}</span></span><span title={`实际已下单 ${summary.ordered}/${summary.total} 件`}><Truck size={15} aria-hidden="true" /><span>下单 {summary.ordered}/{summary.total}</span></span><span title={`已登记到货 ${summary.arrived}/${summary.total} 件`}><PackageOpen size={15} aria-hidden="true" /><span>到货 {summary.arrived}/{summary.total}</span></span></div> : <span className="repair-parts-unknown"><CircleHelp size={16} aria-hidden="true" />必需配件待核对</span>}
                  </div>
                  <div className="repair-module-row__cell repair-module-row__owner"><strong><Flag size={14} className={`repair-priority repair-priority--${repair.priority === "紧急" ? "urgent" : repair.priority === "优先" ? "high" : "normal"}`} aria-label={`${repair.priority}优先级`} role="img" />{repair.technician}</strong><small className="repair-updated"><Clock3 size={13} aria-hidden="true" /><time dateTime={updated.replace(" ", "T")} title={`最后更新 ${updated}（门店时间）`}>{updated.slice(5, 16).replaceAll("-", "/")}</time></small></div>
                  <RepairStageControl order={repair} onSaved={nextStatus => {
                    const next = { ...(workflows[repair.id] ?? initialRepairWorkflow(repair)), status: nextStatus };
                    const nextGroup = groupBy === "none" ? "all" : groupBy === "workflow" ? workflowGroup(repair, records, next) : summary.group;
                    setOpenGroups(previous => ({ ...previous, [nextGroup]: true }));
                    requestAnimationFrame(() => (document.getElementById(`repair-stage-${repair.id}`) ?? document.getElementById("repair-search"))?.focus());
                  }} />
                  <div className="repair-module-row__quick"><RepairProcurementShortcut repairId={repair.id} onOpen={setActiveRepairId} /></div>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
      {!filteredRepairs.length ? <div className="module-empty"><Search size={28} /><strong>没有符合条件的工单</strong><button type="button" onClick={clearFilters}>清除筛选</button></div> : null}
    </section>
    {editingGroups && canManageGroups ? <RepairGroupEditor key={`${staff.member?.id}:${staff.member?.revision}:${editingGroups}`} settings={settings} kind={editingGroups} onClose={closeGroupEditor} onSaved={() => { setGroupFeedback("分组已保存"); closeGroupEditor(); }} /> : null}
    <RepairProcurementDialog key={activeRepairId ?? "closed"} repairId={activeRepairId} onClose={closeShortcut} />
    {feedback && !feedback.error && !activeRepairId ? <div className="repair-parts-notification" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{feedback.message}</span><button className="icon-button" type="button" aria-label="关闭操作提示" onClick={() => dispatch({ type: "clear-feedback" })}><X size={18} /></button></div> : null}
  </main>;
}
