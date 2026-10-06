"use client";

import { useLanguage } from "@/components/language-provider";
import { repairCustomerName, repairIssueText, repairItemText, repairKnownText } from "@/lib/i18n/repair-display";
import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  ArrowUpDown, ChevronRight, CircleHelp,
  ClipboardList, Clock3, Flag, Gamepad2, Laptop, SlidersHorizontal, RotateCcw, Layers,
  PackageCheck, PackageSearch, Plus, Search, ShoppingCart,
  Smartphone, Tablet, Truck, X, CheckCircle2,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStaff } from "@/components/staff/use-staff";
import { useProcurement, currentProcurementRecords } from "@/components/procurement/procurement-provider";
import { RepairProcurementDialog } from "@/components/procurement/repair-procurement-shortcut";
import { repairPartsSummary, type RepairPartsGroup } from "@/lib/procurement";
import { compareRepairUpdates, repairUpdatedAt } from "@/lib/repair-list-order";
import { initialRepairWorkflow, workflowGroup, repairStageStatus, isRepairHistory, hasCurrentRepairHandover, pickupNotice } from "@/lib/repair-workflow";
import { RepairContactControl } from "./repair-contact-control";
import { SupplierBatchDialog } from "@/components/procurement/supplier-batch-dialog";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { RepairStageControl } from "./repair-stage-control";
import { useRepairWorkflows, currentRepairWorkflow } from "./repair-workflow-store";
import { repairStatusOptions, type RepairStatus } from "@/lib/repair-fixtures";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";
import { RepairScanner } from "./repair-scanner";

import { useStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, visibleRepairGroups } from "@/lib/repair-groups";
import { backendSnapshot, isBackendClient } from "@/lib/backend/client";
import { clearRepairListView, repairListViewScope, readRepairListView, writeRepairListView, captureRepairListPosition, restoreRepairListPosition, type RepairListViewState } from "@/lib/repair-list-view-state";

type StatusFilter = "all" | "including_cancelled" | "handover" | RepairStatus;

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
  const { t } = useLanguage();
  return <div className="repair-module-table__head" aria-hidden="true"><span>{t("工单 / 设备")}</span><span>{t("客户")}</span><span>{t("供应商 / 配件")}</span><span>{t("维修阶段")}</span><span>{t("联系 / 跟进")}</span><span>{t("负责人 / 更新")}</span></div>;
}

export function RepairList() {
  const { t } = useLanguage();
  const staff = useStaff();
  const scope = repairListViewScope({ mode: isBackendClient() ? "backend" : "preview", storeId: backendSnapshot()?.storeId ?? "local-preview", member: staff.member });
  useEffect(() => { if (staff.ready && !scope) clearRepairListView(); }, [staff.ready, scope]);
  return scope ? <Suspense fallback={<section className="panel module-empty" role="status">{t("正在读取工单…")}</section>}><ScopedRepairList key={scope} scope={scope} /></Suspense> : <main className="module-page repair-page"><header className="module-heading"><PageTitle title={t("维修工单")} /></header><section className="panel section-empty" role="status">{staff.ready ? t("当前账号无法读取维修工单") : t("正在读取工单…")}</section></main>;
}

function ScopedRepairList({ scope }: { scope: string }) {
  const { t, locale , systemText } = useLanguage();
  const staff = useStaff();
  const params = useSearchParams();
  const requestedHistory = params.get("view") === "history";
  const requestedHandover = requestedHistory && params.get("status") === "handover";
  const [restored] = useState(() => requestedHistory ? { ...readRepairListView(scope), query: "", view: "history" as const, status: requestedHandover ? "handover" as const : "all" as const, partsFilter: "all" as const, filtersOpen: requestedHandover } : readRepairListView(scope));
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
  const [status, setStatus] = useState<StatusFilter>(restored?.status === "including_cancelled" ? "all" : restored?.status ?? "all");
  const [view, setView] = useState<"active" | "history" | "all">(restored?.view ?? (["completed", "cancelled", "handover"].includes(restored?.status ?? "") ? "history" : "active"));
  const [noticeFilter, setNoticeFilter] = useState<"all" | "unnotified" | "notified">(restored?.noticeFilter ?? "all");
  const [partsFilter, setPartsFilter] = useState<"all" | RepairPartsGroup>(restored?.partsFilter ?? "all");
  const [groupBy, setGroupBy] = useState<RepairListViewState["groupBy"]>(restored?.groupBy ?? "workflow");
  const [sort, setSort] = useState<RepairListViewState["sort"]>(restored?.sort ?? "updated");
  const [filtersOpen, setFiltersOpen] = useState(restored?.filtersOpen ?? false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(restored?.openGroups ?? {});
  const [batchAction, setBatchAction] = useState<"ordered" | "arrival" | null>(null);
  const [activeRepairId, setActiveRepairId] = useState<string | null>(null);


  useEffect(() => {
    const savedView = { query, status, partsFilter, groupBy, sort, filtersOpen, openGroups, view, noticeFilter, ...position.current };
    currentView.current = savedView;
    if (!restoring.current && !navigating.current) writeRepairListView(scope, savedView);
  }, [scope, query, status, partsFilter, groupBy, sort, filtersOpen, openGroups, view, noticeFilter]);
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
    writeRepairListView(scope, { query, status, partsFilter, groupBy, sort, filtersOpen, openGroups, view, noticeFilter, ...captureRepairListPosition(table.current) });
  }

  const summaries = new Map(repairOrders.map((repair) => [repair.id, repairPartsSummary(records, repair.id, currentRepairRequirements(repair, workflows[repair.id]))]));
  const histories = new Map(repairOrders.map(order => [order.id, isRepairHistory(order, workflows[order.id])]));
  const historyCount = repairOrders.filter(order => histories.get(order.id)).length;
  const filteredRepairs = repairOrders.filter((repair) => {
    const workflow = workflows[repair.id] ?? initialRepairWorkflow(repair);
    const stage = repairStageStatus(workflow);
    const searchable = [repair.id, repair.customer.name, repair.customer.phone, repair.device.brand, repair.device.model, repair.device.serial, repair.issue].join(" ").toLocaleLowerCase();
    return (view === "all" || (view === "history" ? histories.get(repair.id) : !histories.get(repair.id)))
      && (status === "including_cancelled" || status === "all" || (status === "handover" ? hasCurrentRepairHandover(workflow) && Boolean(workflow.followUp?.collectedUnpaid) : stage === status))
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
  const groups = view === "history" ? [{ key: "all", label: "历史工单", rows: filteredRepairs }]
    : groupBy === "parts"
    ? groupSettings.parts.map(({key, label}) => ({ key, label, rows: filteredRepairs.filter((repair) => summaries.get(repair.id)!.group === key) }))
    : groupBy === "workflow" ? [...visibleRepairGroups(groupSettings, "workflow").map(({key, label}) => ({ key, label, rows: filteredRepairs.filter(order => workflowGroup(order, records, workflows[order.id]) === key) })), ...(view === "all" ? [{ key: "history", label: "历史工单", rows: filteredRepairs.filter(order => histories.get(order.id)) }] : [])]
    : [{ key: "all", label: "全部工单", rows: filteredRepairs }];
  const clearFilters = () => { setQuery(""); setStatus("all"); setPartsFilter("all"); setNoticeFilter("all"); };
  const switchView = (next: "active" | "history" | "all") => { if (requestedHistory) window.history.replaceState(null,"","/app/repairs"); setView(next); setStatus("all"); setNoticeFilter("all"); };
  function followSaved(repair: typeof repairOrders[number], focus: "stage" | "contact" | "parts" = "stage", moveFocus = true) {
    const next = currentRepairWorkflow(repair), nextRecords = currentProcurementRecords();
    const history = isRepairHistory(repair, next), stage = repairStageStatus(next);
    if (view !== "all") setView(history ? "history" : "active");
    if (status !== "all" && status !== "including_cancelled") setStatus(status === "handover" && hasCurrentRepairHandover(next) ? "handover" : stage);
    if (noticeFilter !== "all" && workflowGroup(repair, nextRecords, next) === "ready") setNoticeFilter(pickupNotice(next).startsWith("已通知") ? "notified" : "unnotified");
    if (partsFilter !== "all") setPartsFilter(repairPartsSummary(nextRecords,repair.id,currentRepairRequirements(repair,next)).group);
    const group = history ? view === "all" ? "history" : "all" : groupBy === "none" ? "all" : groupBy === "workflow" ? workflowGroup(repair, nextRecords, next) : repairPartsSummary(nextRecords,repair.id,currentRepairRequirements(repair,next)).group;
    setOpenGroups(previous => ({ ...previous, [group]: true }));
    if (moveFocus) requestAnimationFrame(() => {
      const target = document.getElementById(`repair-${focus === "parts" ? "action" : focus}-${repair.id}`) ?? document.getElementById(`repair-group-${group}`) ?? document.getElementById("repair-search");
      target?.focus({preventScroll:true});target?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
    });
  }

  function closeShortcut() {
    const id = activeRepairId;
    setActiveRepairId(null);
    if (!id) return;
    const order = repairOrders.find(order => order.id === id);
    if (order) { followSaved(order,"parts"); return; }
    const group = "all";
    setOpenGroups((previous) => ({ ...previous, [group]: true }));
    requestAnimationFrame(() => {
      const target = document.getElementById(`repair-action-${id}`) ?? document.getElementById(`repair-group-${group}`) ?? document.getElementById("repair-search");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    });
  }

  return <main className="module-page repair-page repair-parts-list repair-unified-list">
    <header className="module-heading"><PageTitle title={t("维修工单")} /><div className="module-heading__actions"><RepairScanner iconOnly />{canEdit ? <><button className="button button--secondary button--compact" type="button" onClick={() => setBatchAction("ordered")}><ShoppingCart size={17} />{t("采购车")}</button><button className="button button--secondary button--compact" type="button" onClick={() => setBatchAction("arrival")}><PackageCheck size={17} />{t("批量到货")}</button></> : null}{canEdit ? <Link className="button button--primary button--compact" href="/app/repairs/new"><Plus size={17} />{t("新建工单")}</Link> : null}</div></header>
    <section className="panel repair-module-panel">
      <div className="segmented-control repair-list-scope" role="group" aria-label={t("工单范围")}>
        <button type="button" className={view === "active" ? "active" : ""} aria-pressed={view === "active"} onClick={() => switchView("active")}>{t("日常工单 ")}{repairOrders.length-historyCount}</button>
        <button type="button" className={view === "history" ? "active" : ""} aria-pressed={view === "history"} onClick={() => switchView("history")}>{t("历史工单 ")}{historyCount}</button>
        <button type="button" className={view === "all" ? "active" : ""} aria-pressed={view === "all"} onClick={() => switchView("all")}>{t("全部工单 ")}{repairOrders.length}</button>
      </div>
      <div className="repair-filterbar repair-filterbar--focused">
        <label className="module-search"><Search size={18} aria-hidden="true" /><InputControl onClear={() => setQuery("")} clearLabel={t("清空搜索维修工单")} id="repair-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("搜索工单、客户、设备")} aria-label={t("搜索维修工单")} />{query ? <button type="button" onClick={() => setQuery("")}>{t("清除")}</button> : null}<span className="repair-result-count">{filteredRepairs.length} {t(" 单")}</span></label>
        <button type="button" className={`button button--secondary repair-filter-trigger${status !== "all" || partsFilter !== "all" ? " repair-filter-trigger--active" : ""}`} aria-expanded={filtersOpen} aria-controls="repair-filter-options" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} /><span>{t("筛选")}{status !== "all" || partsFilter !== "all" ? ` · ${Number(status !== "all")+Number(partsFilter !== "all")}` : ""}</span></button>
        <label className="module-select repair-view-select"><Layers size={16} aria-hidden="true" /><SelectControl aria-label={t("工单分组")} value={groupBy} onChange={event => setGroupBy(event.target.value as RepairListViewState["groupBy"])}><option value="workflow">{t("维修分组")}</option><option value="parts">{t("配件分组")}</option><option value="none">{t("全部工单 ")}</option></SelectControl></label>
        <label className="module-select repair-view-select"><ArrowUpDown size={16} aria-hidden="true" /><SelectControl value={sort} onChange={event => setSort(event.target.value as RepairListViewState["sort"])} aria-label={t("工单排序")}><option value="updated">{t("更新：旧 → 新")}</option><option value="created">{t("建单：旧 → 新")}</option><option value="priority">{t("优先级")}</option></SelectControl></label>
        {filtersOpen ? <div id="repair-filter-options" className="repair-filter-options repair-filter-options--open"><label className="module-select"><SelectControl aria-label={t("维修阶段筛选")} value={status} onChange={event => { const next=event.target.value as StatusFilter; setStatus(next); if (["completed","cancelled","handover"].includes(next)) setView("history"); else if(!["all","including_cancelled"].includes(next) && view==="history") setView("active"); }}><option value="all">{t("全部阶段")}</option><option value="handover">{t("已取机待收尾")}</option>{repairStatusOptions.filter(option => !["ready_notified", "awaiting_reply", "collected_unpaid"].includes(option.value)).map(option => <option value={option.value} key={option.value}>{option.value === "awaiting_parts" ? t("待选配件") : option.value === "ready" ? t("等取机") : t(option.label)}</option>)}</SelectControl></label><label className="module-select"><SelectControl aria-label={t("配件状态筛选")} value={partsFilter} onChange={event => setPartsFilter(event.target.value as "all" | RepairPartsGroup)}><option value="all">{t("全部配件状态")}</option>{groupSettings.parts.map(({key,label}) => <option value={key} key={key}>{label}</option>)}</SelectControl></label><button className="button button--secondary repair-filter-reset" type="button" onClick={clearFilters}><RotateCcw size={15} />{t("重置")}</button></div> : null}
      </div>
      {storageError || workflowError || settingsError ? <p className="form-error" role="alert">{systemText(storageError || workflowError || settingsError || "")}</p> : null}
      <div ref={table} className="module-table-scroll" role="region" aria-label={t("工单表格")} tabIndex={0}>
        {groups.filter(group => groupBy === "parts" || group.rows.length > 0).map((group) => {
          const grouped = group.key !== "all";
          const notifiedCount = group.key === "ready" ? group.rows.filter(order => pickupNotice(workflows[order.id] ?? initialRepairWorkflow(order)).startsWith("已通知")).length : 0;
          const groupRows = group.key === "ready" && noticeFilter !== "all" ? group.rows.filter(order => pickupNotice(workflows[order.id] ?? initialRepairWorkflow(order)).startsWith("已通知") === (noticeFilter === "notified")) : group.rows;
          const visual = grouped && groupBy === "parts" ? groupVisuals[group.key as RepairPartsGroup] : grouped ? { icon: ClipboardList, tone: (["complete", "ready", "ready_notified"].includes(group.key) ? "success" : ["cancelled", "awaiting_reply", "collected_unpaid"].includes(group.key) ? "warning" : "info") } : null;
          const GroupIcon = visual?.icon;
          const expanded = !grouped || (openGroups[group.key] ?? (groupBy === "workflow"));
          return <section className={`repair-parts-group${visual ? ` repair-parts-group--${visual.tone}` : ""}${expanded ? " repair-parts-group--expanded" : ""}`} key={group.key} aria-label={groupBy === "workflow" ? t(group.label) : group.label}>
            {grouped ? <h3><button id={`repair-group-${group.key}`} className="repair-group-toggle" type="button" aria-expanded={expanded} aria-controls={`repair-group-rows-${group.key}`} onClick={() => setOpenGroups((previous) => ({ ...previous, [group.key]: !(previous[group.key] ?? (groupBy === "workflow")) }))}><ChevronRight className="repair-group-chevron" size={17} aria-hidden="true" />{GroupIcon ? <GroupIcon className="repair-group-icon" size={18} aria-hidden="true" /> : null}<span>{groupBy === "workflow" ? t(group.label) : group.label}</span><small>{group.rows.length}</small></button></h3> : null}
            <div id={`repair-group-rows-${group.key}`} className="repair-module-list" hidden={!expanded}>
              {group.key === "ready" ? <div className="repair-notice-filters segmented-control" role="group" aria-label={t("等取机通知筛选")}>{([ ["all", "全部", group.rows.length], ["unnotified", "未通知", group.rows.length-notifiedCount], ["notified", "已通知", notifiedCount] ] as const).map(([key,label,count]) => <button key={key} type="button" className={noticeFilter === key ? "active" : ""} aria-pressed={noticeFilter === key} onClick={() => setNoticeFilter(key)}>{t(label)} {count}</button>)}</div> : null}

              {groupRows.length ? <TableHead /> : <div className="section-empty">{group.key === "ready" ? t("暂无{v0}的工单", { v0: noticeFilter === "notified" ? t("已通知") : t("未通知") }) : t("暂无符合条件的工单")}</div>}
              {groupRows.map((repair) => {
                const DeviceIcon = deviceIcons[repair.device.category as keyof typeof deviceIcons] ?? CircleHelp;
                const parts = records.filter(row => row.repairId === repair.id);
                const suppliers = [...new Set(parts.map(row => row.supplier))].join("、");
                const updated = repairUpdatedAt(repair, repairUpdates);
                return <article className="repair-module-row" key={repair.id} aria-label={`${repair.id} ${repair.device.model}`}>
                  <div className="repair-module-row__device"><span className="device-glyph" title={repairKnownText(repair.device.category, locale)}><DeviceIcon size={20} aria-hidden="true" /></span><div><Link className="repair-row-link" onClick={rememberBeforeNavigation} href={`/app/repairs/${repair.id}`} aria-label={t("打开 {v0} {v1} 详情", { v0: repair.id, v1: repair.device.model })} title={`${repair.device.model} · ${repairIssueText(repair, locale)}`}><strong>{repair.device.model}</strong>{repair.repairOrigin ? <span className="repair-rework-tag">{t("返修")}</span> : null}</Link></div></div>
                  <div className="repair-module-row__cell repair-module-row__customer"><strong>{repairCustomerName(repair, locale)}</strong><small>{repair.customer.phone}</small></div>
                  <div className="repair-row-parts-cell"><button id={`repair-action-${repair.id}`} className="button button--secondary repair-row-parts" type="button" onClick={() => setActiveRepairId(repair.id)} aria-label={t("{v0} 供应商与配件{v1}", { v0: repair.id, v1: canEdit ? t("操作") : t("详情") })} title={parts.map(row => `${row.supplier} · ${repairItemText(row.item, locale)}`).join("\n") || (canEdit ? t("选择供应商与配件") : t("查看供应商与配件"))}><span className="repair-row-parts__body"><PackageSearch size={17} aria-hidden="true" /><span><strong>{suppliers || (canEdit ? t("选择配件") : t("查看配件"))}</strong><small>{parts.length ? `${repairItemText(parts[0].item, locale)}${parts.length > 1 ? ` +${parts.length - 1}` : ""}` : t("供应商 · 报价")}</small></span></span><ChevronRight size={16} aria-hidden="true" /></button></div>
                  <RepairStageControl variant="list" order={repair} onSaved={() => followSaved(repair)} />
                  <div className="repair-module-row__quick"><RepairContactControl variant="list" order={repair} onSaved={() => followSaved(repair,"contact")} /></div>
                  <div className="repair-module-row__cell repair-module-row__owner"><strong><Flag size={14} className={`repair-priority repair-priority--${repair.priority === "紧急" ? "urgent" : repair.priority === "优先" ? "high" : "normal"}`} aria-label={t("{v0}优先级", { v0: t(repair.priority) })} role="img" />{repair.technician === "未分配" ? t("未分配") : repair.technician}</strong><small className="repair-updated"><Clock3 size={13} aria-hidden="true" /><time dateTime={updated.replace(" ", "T")} title={t("最后更新 {v0}（门店时间）", { v0: updated })}>{updated.slice(5, 16).replaceAll("-", "/")}</time></small></div>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
      {!filteredRepairs.length ? <div className="module-empty"><Search size={28} /><strong>{t("没有符合条件的工单")}</strong><button type="button" onClick={clearFilters}>{t("清除筛选")}</button></div> : null}
    </section>
    {batchAction && canEdit ? <SupplierBatchDialog key={`${staff.member?.id}:${staff.member?.revision}:${batchAction}`} action={batchAction} onSaved={ids => { const affected = filteredRepairs.find(row => ids.includes(row.id)) ?? repairOrders.find(row => ids.includes(row.id)); if (affected) followSaved(affected,"parts",false); setOpenGroups(previous => ({...previous,processing:true,rework:true,purchase:true,ready:true})); }} onClose={() => setBatchAction(null)} /> : null}
    <RepairProcurementDialog key={`${staff.member?.id}:${staff.member?.revision}:${activeRepairId ?? "closed"}`} repairId={activeRepairId} onClose={closeShortcut} />
    {feedback && !feedback.error && !activeRepairId ? <div className="repair-parts-notification" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{systemText(feedback.message)}</span><button className="icon-button" type="button" aria-label={t("关闭操作提示")} onClick={() => dispatch({ type: "clear-feedback" })}><X size={18} /></button></div> : null}
  </main>;
}
