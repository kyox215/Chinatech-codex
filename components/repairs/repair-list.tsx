"use client";

import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  ArrowUpDown, ChevronRight, CircleHelp,
  ClipboardList, Clock3, Flag, Gamepad2, Laptop, SlidersHorizontal, RotateCcw, Layers,
  PackageCheck, PackageSearch, Plus, Search, ShoppingCart,
  Smartphone, Tablet, Truck, X, CheckCircle2,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { useProcurement } from "@/components/procurement/procurement-provider";
import { RepairProcurementDialog } from "@/components/procurement/repair-procurement-shortcut";
import { repairPartsSummary, type RepairPartsGroup } from "@/lib/procurement";
import { compareRepairUpdates, repairUpdatedAt } from "@/lib/repair-list-order";
import { initialRepairWorkflow, workflowGroup } from "@/lib/repair-workflow";
import { RepairContactControl } from "./repair-contact-control";
import { SupplierBatchDialog } from "@/components/procurement/supplier-batch-dialog";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { RepairStageControl } from "./repair-stage-control";
import { useRepairWorkflows } from "./repair-workflow-store";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { RepairScanner } from "./repair-scanner";

import { useStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, visibleRepairGroups } from "@/lib/repair-groups";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { clearRepairListView, repairListViewScope, readRepairListView, writeRepairListView, captureRepairListPosition, restoreRepairListPosition, type RepairListViewState } from "@/lib/repair-list-view-state";

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
  return <div className="repair-module-table__head" aria-hidden="true"><span>工单 / 设备</span><span>客户</span><span>供应商 / 配件</span><span>维修阶段</span><span>联系 / 跟进</span><span>负责人 / 更新</span></div>;
}

export function RepairList() {
  const staff = useStaff();
  const scope = repairListViewScope({ mode: isBackendClient() ? "backend" : "preview", storeId: backendSnapshot()?.storeId ?? "local-preview", member: staff.member });
  useEffect(() => { if (staff.ready && !scope) clearRepairListView(); }, [staff.ready, scope]);
  return scope ? <ScopedRepairList key={scope} scope={scope} /> : <main className="module-page repair-page"><header className="module-heading"><PageTitle title="维修工单" /></header><section className="panel section-empty" role="status">{staff.ready ? "当前账号无法读取维修工单" : "正在读取工单…"}</section></main>;
}

function ScopedRepairList({ scope }: { scope: string }) {
  const staff = useStaff();
  const [restored] = useState(() => readRepairListView(scope));
  const table = useRef<HTMLDivElement>(null);
  const position = useRef({ scrollY: restored?.scrollY ?? 0, scrollLeft: restored?.scrollLeft ?? 0 });
  const restoring = useRef(Boolean(restored));
  const navigating = useRef(false);
  const currentView = useRef<RepairListViewState | null>(null);
  const canEdit = staff.can("repairs.edit");
  const { settings, ready: settingsReady, error: settingsError } = useStoreSettings();
  const groupSettings = settings.repairGroups ?? defaultRepairGroups();
  const repairOrders = useRepairDirectory();
  const { ready: intakesReady } = useLocalIntakes();
  const { workflows, ready: workflowReady, error: workflowError } = useRepairWorkflows();
  const { records, feedback, dispatch, repairUpdates, storageError } = useProcurement();
  const [query, setQuery] = useState(restored?.query ?? "");
  const [status, setStatus] = useState<StatusFilter>(restored?.status ?? "all");
  const [partsFilter, setPartsFilter] = useState<"all" | RepairPartsGroup>(restored?.partsFilter ?? "all");
  const [groupBy, setGroupBy] = useState<RepairListViewState["groupBy"]>(restored?.groupBy ?? "workflow");
  const [sort, setSort] = useState<RepairListViewState["sort"]>(restored?.sort ?? "updated");
  const [filtersOpen, setFiltersOpen] = useState(restored?.filtersOpen ?? false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(restored?.openGroups ?? {});
  const [batchAction, setBatchAction] = useState<"ordered" | "arrival" | null>(null);
  const [activeRepairId, setActiveRepairId] = useState<string | null>(null);


  useEffect(() => {
    const view = { query, status, partsFilter, groupBy, sort, filtersOpen, openGroups, ...position.current };
    currentView.current = view;
    if (!restoring.current && !navigating.current) writeRepairListView(scope, view);
  }, [scope, query, status, partsFilter, groupBy, sort, filtersOpen, openGroups]);
  useEffect(() => {
    const scroll = () => {
      if (restoring.current || navigating.current || !currentView.current) return;
      position.current = captureRepairListPosition(table.current);
      currentView.current = { ...currentView.current, ...position.current };
      writeRepairListView(scope, currentView.current);
    };
    const region = table.current;
    window.addEventListener("scroll", scroll, { passive: true });
    region?.addEventListener("scroll", scroll, { passive: true });
    return () => { window.removeEventListener("scroll", scroll); region?.removeEventListener("scroll", scroll); };
  }, [scope]);
  useEffect(() => {
    if (!intakesReady || !workflowReady || !settingsReady) return;
    const saved = readRepairListView(scope);
    navigating.current = false;
    if (!saved) { restoring.current = false; return; }
    restoring.current = true;
    let live = true;
    const stop = restoreRepairListPosition(saved, table.current, () => live, () => {
      if (!live) return;
      restoring.current = false;
      position.current = captureRepairListPosition(table.current);
      if (currentView.current) { currentView.current = { ...currentView.current, ...position.current }; writeRepairListView(scope, currentView.current); }
    });
    return () => { live = false; stop(); };
  }, [intakesReady, workflowReady, settingsReady, scope]);
  function rememberBeforeNavigation(event: MouseEvent<HTMLAnchorElement>) {
    navigating.current = !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
    writeRepairListView(scope, { query, status, partsFilter, groupBy, sort, filtersOpen, openGroups, ...captureRepairListPosition(table.current) });
  }

  const summaries = new Map(repairOrders.map((repair) => [repair.id, repairPartsSummary(records, repair.id, currentRepairRequirements(repair, workflows[repair.id]))]));
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
    : groupBy === "workflow" ? visibleRepairGroups(groupSettings, "workflow").map(({key, label}) => ({ key, label, rows: filteredRepairs.filter(order => workflowGroup(order, records, workflows[order.id]) === key) }))
    : [{ key: "all", label: "全部工单", rows: filteredRepairs }];
  const clearFilters = () => { setQuery(""); setStatus("all"); setPartsFilter("all"); };

  function closeShortcut() {
    const id = activeRepairId;
    setActiveRepairId(null);
    if (!id) return;
    const order = repairOrders.find(order => order.id === id);
    const group = groupBy === "none" ? "all" : groupBy === "workflow" && order ? workflowGroup(order, records, workflows[id]) : summaries.get(id)?.group ?? "all";
    setOpenGroups((previous) => ({ ...previous, [group]: true }));
    requestAnimationFrame(() => {
      const target = document.getElementById(`repair-action-${id}`) ?? document.getElementById(`repair-group-${group}`) ?? document.getElementById("repair-search");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    });
  }

  return <main className="module-page repair-page repair-parts-list repair-unified-list">
    <header className="module-heading"><PageTitle title="维修工单" /><div className="module-heading__actions"><RepairScanner iconOnly />{canEdit ? <><button className="button button--secondary button--compact" type="button" onClick={() => setBatchAction("ordered")}><ShoppingCart size={17} />采购车</button><button className="button button--secondary button--compact" type="button" onClick={() => setBatchAction("arrival")}><PackageCheck size={17} />批量到货</button></> : null}{canEdit ? <Link className="button button--primary button--compact" href="/app/repairs/new"><Plus size={17} />新建工单</Link> : null}</div></header>
    <section className="panel repair-module-panel">
      <div className="repair-filterbar repair-filterbar--focused">
        <label className="module-search"><Search size={18} aria-hidden="true" /><InputControl onClear={() => setQuery("")} clearLabel="清空搜索维修工单" id="repair-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工单、客户、设备" aria-label="搜索维修工单" />{query ? <button type="button" onClick={() => setQuery("")}>清除</button> : null}<span className="repair-result-count">{filteredRepairs.length} 单</span></label>
        <button type="button" className={`button button--secondary repair-filter-trigger${status !== "all" || partsFilter !== "all" ? " repair-filter-trigger--active" : ""}`} aria-expanded={filtersOpen} aria-controls="repair-filter-options" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} /><span>筛选{status !== "all" || partsFilter !== "all" ? ` · ${Number(status !== "all")+Number(partsFilter !== "all")}` : ""}</span></button>
        <label className="module-select repair-view-select"><Layers size={16} aria-hidden="true" /><SelectControl aria-label="工单分组" value={groupBy} onChange={event => setGroupBy(event.target.value as RepairListViewState["groupBy"])}><option value="workflow">维修分组</option><option value="parts">配件分组</option><option value="none">全部工单</option></SelectControl></label>
        <label className="module-select repair-view-select"><ArrowUpDown size={16} aria-hidden="true" /><SelectControl value={sort} onChange={event => setSort(event.target.value as RepairListViewState["sort"])} aria-label="工单排序"><option value="updated">更新：旧 → 新</option><option value="created">建单：旧 → 新</option><option value="priority">优先级</option></SelectControl></label>
        {filtersOpen ? <div id="repair-filter-options" className="repair-filter-options repair-filter-options--open"><label className="module-select"><SelectControl aria-label="维修阶段筛选" value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="all">全部阶段（不含作废）</option><option value="including_cancelled">全部阶段（含作废）</option>{repairStatusOptions.filter(option => !["ready_notified", "awaiting_reply", "collected_unpaid"].includes(option.value)).map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</SelectControl></label><label className="module-select"><SelectControl aria-label="配件状态筛选" value={partsFilter} onChange={event => setPartsFilter(event.target.value as "all" | RepairPartsGroup)}><option value="all">全部配件状态</option>{groupSettings.parts.map(({key,label}) => <option value={key} key={key}>{label}</option>)}</SelectControl></label><button className="button button--secondary repair-filter-reset" type="button" onClick={clearFilters}><RotateCcw size={15} />重置</button></div> : null}
      </div>
      {storageError || workflowError || settingsError ? <p className="form-error" role="alert">{storageError || workflowError || settingsError}</p> : null}
      <div ref={table} className="module-table-scroll" role="region" aria-label="工单表格" tabIndex={0}>
        {groups.map((group) => {
          const grouped = group.key !== "all";
          const groupRows = group.rows;
          const visual = grouped && groupBy === "parts" ? groupVisuals[group.key as RepairPartsGroup] : grouped ? { icon: ClipboardList, tone: (["complete", "ready", "ready_notified"].includes(group.key) ? "success" : ["cancelled", "awaiting_reply", "collected_unpaid"].includes(group.key) ? "warning" : "info") } : null;
          const GroupIcon = visual?.icon;
          const expanded = !grouped || Boolean(openGroups[group.key]);
          return <section className={`repair-parts-group${visual ? ` repair-parts-group--${visual.tone}` : ""}${expanded ? " repair-parts-group--expanded" : ""}`} key={group.key} aria-label={group.label}>
            {grouped ? <h3><button id={`repair-group-${group.key}`} className="repair-group-toggle" type="button" aria-expanded={expanded} aria-controls={`repair-group-rows-${group.key}`} onClick={() => setOpenGroups((previous) => ({ ...previous, [group.key]: !previous[group.key] }))}><ChevronRight className="repair-group-chevron" size={17} aria-hidden="true" />{GroupIcon ? <GroupIcon className="repair-group-icon" size={18} aria-hidden="true" /> : null}<span>{group.label}</span><small>{group.rows.length}</small></button></h3> : null}
            <div id={`repair-group-rows-${group.key}`} className="repair-module-list" hidden={!expanded}>

              {groupRows.length ? <TableHead /> : <div className="section-empty">暂无符合条件的工单{group.key === "cancelled" && status === "all" ? <button className="button button--secondary button--tiny" type="button" onClick={() => setStatus("cancelled")}>查看作废工单</button> : null}</div>}
              {groupRows.map((repair) => {
                const summary = summaries.get(repair.id)!;
                const DeviceIcon = deviceIcons[repair.device.category as keyof typeof deviceIcons] ?? CircleHelp;
                const parts = records.filter(row => row.repairId === repair.id);
                const suppliers = [...new Set(parts.map(row => row.supplier))].join("、");
                const updated = repairUpdatedAt(repair, repairUpdates);
                return <article className="repair-module-row" key={repair.id} aria-label={`${repair.id} ${repair.device.model}`}>
                  <div className="repair-module-row__device"><span className="device-glyph" title={repair.device.category}><DeviceIcon size={20} aria-hidden="true" /></span><div><Link className="repair-row-link" onClick={rememberBeforeNavigation} href={`/app/repairs/${repair.id}`} aria-label={`打开 ${repair.id} ${repair.device.model} 详情`} title={`${repair.device.model} · ${repair.issue}`}><strong>{repair.device.model}</strong></Link></div></div>
                  <div className="repair-module-row__cell repair-module-row__customer"><strong>{repair.customer.name}</strong><small>{repair.customer.phone}</small></div>
                  <div className="repair-row-parts-cell"><button id={`repair-action-${repair.id}`} className="button button--secondary repair-row-parts" type="button" onClick={() => setActiveRepairId(repair.id)} aria-label={`${repair.id} 供应商与配件${canEdit ? "操作" : "详情"}`} title={parts.map(row => `${row.supplier} · ${row.item}`).join("\n") || (canEdit ? "选择供应商与配件" : "查看供应商与配件")}><span className="repair-row-parts__body"><PackageSearch size={17} aria-hidden="true" /><span><strong>{suppliers || (canEdit ? "选择配件" : "查看配件")}</strong><small>{parts.length ? `${parts[0].item}${parts.length > 1 ? ` +${parts.length - 1}` : ""}` : "供应商 · 报价"}</small></span></span><ChevronRight size={16} aria-hidden="true" /></button></div>
                  <RepairStageControl variant="list" order={repair} onSaved={nextStatus => {
                    const next = { ...(workflows[repair.id] ?? initialRepairWorkflow(repair)), status: nextStatus };
                    const nextGroup = groupBy === "none" ? "all" : groupBy === "workflow" ? workflowGroup(repair, records, next) : summary.group;
                    setOpenGroups(previous => ({ ...previous, [nextGroup]: true }));
                    requestAnimationFrame(() => (document.getElementById(`repair-stage-${repair.id}`) ?? document.getElementById("repair-search"))?.focus());
                  }} />
                  <div className="repair-module-row__quick"><RepairContactControl variant="list" order={repair} /></div>
                  <div className="repair-module-row__cell repair-module-row__owner"><strong><Flag size={14} className={`repair-priority repair-priority--${repair.priority === "紧急" ? "urgent" : repair.priority === "优先" ? "high" : "normal"}`} aria-label={`${repair.priority}优先级`} role="img" />{repair.technician}</strong><small className="repair-updated"><Clock3 size={13} aria-hidden="true" /><time dateTime={updated.replace(" ", "T")} title={`最后更新 ${updated}（门店时间）`}>{updated.slice(5, 16).replaceAll("-", "/")}</time></small></div>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
      {!filteredRepairs.length ? <div className="module-empty"><Search size={28} /><strong>没有符合条件的工单</strong><button type="button" onClick={clearFilters}>清除筛选</button></div> : null}
    </section>
    {batchAction && canEdit ? <SupplierBatchDialog key={`${staff.member?.id}:${staff.member?.revision}:${batchAction}`} action={batchAction} onClose={() => setBatchAction(null)} /> : null}
    <RepairProcurementDialog key={`${staff.member?.id}:${staff.member?.revision}:${activeRepairId ?? "closed"}`} repairId={activeRepairId} onClose={closeShortcut} />
    {feedback && !feedback.error && !activeRepairId ? <div className="repair-parts-notification" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{feedback.message}</span><button className="icon-button" type="button" aria-label="关闭操作提示" onClick={() => dispatch({ type: "clear-feedback" })}><X size={18} /></button></div> : null}
  </main>;
}
