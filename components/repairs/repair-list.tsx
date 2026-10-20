"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import { Toast, toastNoticeId } from "@/components/toast";
import { ReadPending } from "@/components/page-recovery";
import { useBackendState } from "@/components/backend-snapshot";

import { useLanguage } from "@/components/language-provider";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { useProcurement, currentProcurementRecords } from "@/components/procurement/procurement-provider";
import { RepairProcurementDialog } from "@/components/procurement/repair-procurement-shortcut";
import { repairPartsSummary, type RepairPartsGroup } from "@/lib/procurement";
import { compareRepairUpdates } from "@/lib/repair-list-order";
import { initialRepairWorkflow, workflowGroup, repairStageStatus, isRepairHistory, hasCurrentRepairHandover, pickupNotice } from "@/lib/repair-workflow";
import {RepairContactPresentation,RepairContactDialog} from "./repair-contact-control";
import { SupplierBatchDialog } from "@/components/procurement/supplier-batch-dialog";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import {RepairStageButton,RepairStageDialog} from "./repair-stage-control";
import {RepairListBody} from "./repair-list-body";
import {FormalRepairList} from "./formal-repair-list";
import {repairListSummary,repairListChipFacts} from "@/lib/repair-list-model";
import { useRepairWorkflows, currentRepairWorkflow } from "./repair-workflow-store";
import { type RepairStatus } from "@/lib/repair-fixtures";
import { useLocalIntakes, useRepairDirectory } from "./local-intake-store";

import { useStoreSettings } from "@/components/settings/settings-store";
import { defaultRepairGroups, visibleRepairGroups } from "@/lib/repair-groups";
import { clearRepairListView, repairListViewScope, readRepairListView, writeRepairListView, captureRepairListPosition, restoreRepairListPosition, type RepairListViewState } from "@/lib/repair-list-view-state";

type StatusFilter = "all" | "including_cancelled" | "handover" | RepairStatus;

export function RepairList() {
  const backend=useBackendState();
  const { t } = useLanguage();
  const staff = useStaff();
  const scope = repairListViewScope({ mode: backend.formal ? "backend" : "preview", storeId: backend.snapshot?.storeId ?? "local-preview", member: staff.member });
  useEffect(() => { if (staff.ready && !scope) clearRepairListView(); }, [staff.ready, scope]);
  return scope ? backend.formal&&backend.snapshot?.repairListEnabled?<FormalRepairList key={scope}/>:<ScopedRepairList key={scope} scope={scope} /> : <main className="module-page repair-page"><header className="module-heading"><PageTitle title={t("维修工单")} /></header>{staff.ready ? <section className="panel section-empty" role="alert">{t("当前账号无法读取维修工单")}</section> : <ReadPending label="正在读取工单…" />}</main>;
}

function ScopedRepairList({ scope }: { scope: string }) {
  const { systemText } = useLanguage();
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
  const { records, feedback, repairUpdates, storageError } = useProcurement();
  const [query, setQuery] = useState(restored?.query ?? "");
  const [status, setStatus] = useState<StatusFilter>(restored?.status === "including_cancelled" ? "all" : restored?.status ?? "all");
  const [view, setView] = useState<"active" | "history" | "all">(restored?.view ?? (["completed", "cancelled", "handover"].includes(restored?.status ?? "") ? "history" : "active"));
  const [noticeFilter, setNoticeFilter] = useState<"all" | "unnotified" | "notified">(restored?.noticeFilter ?? "all");
  const [partsFilter, setPartsFilter] = useState<"all" | RepairPartsGroup>(restored?.partsFilter ?? "all");
  const [groupBy, setGroupBy] = useState<RepairListViewState["groupBy"]>(restored?.groupBy ?? "workflow");
  const [sort, setSort] = useState<RepairListViewState["sort"]>(restored?.sort ?? "updated");
  const [filtersOpen, setFiltersOpen] = useState(restored?.filtersOpen ?? false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(restored?.openGroups ?? {});
  const [batchAction, setBatchAction] = useState<"arrival" | null>(null);
  const [activeRepairId, setActiveRepairId] = useState<string | null>(null);
  const [activeStageId,setActiveStageId]=useState<string|null>(null),[activeContactId,setActiveContactId]=useState<string|null>(null);
  const shortcutOrigin = useRef<"parts" | "stage">("parts");
  const openShortcut = (id:string, origin:"parts"|"stage"="parts") => { shortcutOrigin.current=origin; setActiveRepairId(id); };


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
    ? visibleRepairGroups(groupSettings, "parts").map(({key, label}) => ({ key, label, rows: filteredRepairs.filter((repair) => summaries.get(repair.id)!.group === key) }))
    : groupBy === "workflow" ? [...visibleRepairGroups(groupSettings, "workflow").map(({key, label}) => ({ key, label, rows: filteredRepairs.filter(order => workflowGroup(order, records, workflows[order.id]) === key) })), ...(view === "all" ? [{ key: "history", label: "历史工单", rows: filteredRepairs.filter(order => histories.get(order.id)) }] : [])]
    : [{ key: "all", label: "全部工单", rows: filteredRepairs }];
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
    if (order) { followSaved(order,shortcutOrigin.current); return; }
    const group = "all";
    setOpenGroups((previous) => ({ ...previous, [group]: true }));
    requestAnimationFrame(() => {
      const target = document.getElementById(`repair-action-${id}`) ?? document.getElementById(`repair-group-${group}`) ?? document.getElementById("repair-search");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    });
  }

  const viewQuery={q:query,status,view,noticeFilter,partsFilter,groupBy,sort};
  const viewGroups=groups.filter(group=>groupBy==="parts"||group.rows.length>0).map(group=>{
    const notified=group.key==="ready"?group.rows.filter(order=>pickupNotice(workflows[order.id]??initialRepairWorkflow(order)).startsWith("已通知")).length:0;
    const rows=group.key==="ready"&&noticeFilter!=="all"?group.rows.filter(order=>pickupNotice(workflows[order.id]??initialRepairWorkflow(order)).startsWith("已通知")===(noticeFilter==="notified")):group.rows;
    const items=rows.map(order=>repairListSummary(order,records,workflows[order.id],repairUpdates));
    return{key:group.key,label:group.label,count:group.rows.length,visibleCount:rows.length,notified,window:{items,startIndex:0,extent:items.length,hasMore:false}};
  });
  const stageOrder=repairOrders.find(row=>row.id===activeStageId),contactOrder=repairOrders.find(row=>row.id===activeContactId);
  return <RepairListBody partsChips={id=>{const order=repairOrders.find(row=>row.id===id);return order?repairListChipFacts(order,records,workflows[id]):[];}} query={viewQuery} update={patch=>{if(patch.view&&requestedHistory)replaceBackendDocumentUrl("/app/repairs");if(patch.q!==undefined)setQuery(patch.q);if(patch.status!==undefined)setStatus(patch.status);if(patch.view!==undefined)setView(patch.view);if(patch.noticeFilter!==undefined)setNoticeFilter(patch.noticeFilter);if(patch.partsFilter!==undefined)setPartsFilter(patch.partsFilter);if(patch.groupBy!==undefined)setGroupBy(patch.groupBy);if(patch.sort!==undefined)setSort(patch.sort);}} groups={viewGroups} partGroups={visibleRepairGroups(groupSettings,"parts")} stats={{all:repairOrders.length,history:historyCount,active:repairOrders.length-historyCount}} total={filteredRepairs.length} ready={intakesReady&&workflowReady&&settingsReady} error={storageError||workflowError||settingsError} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} openGroups={openGroups} toggleGroup={(key,open)=>setOpenGroups(current=>({...current,[key]:open}))} tableRef={table} onBatch={()=>setBatchAction("arrival")} openParts={openShortcut} onNavigate={event=>rememberBeforeNavigation(event)} resetKey={scope+JSON.stringify(viewQuery)} notice={feedback&&!feedback.error&&!activeRepairId?<Toast message={systemText(feedback.message)} noticeId={toastNoticeId(feedback)}/>:null} stage={row=><RepairStageButton orderId={row.id} triggerId={`repair-stage-${row.id}`} stage={row.stage} progress={row.progress} canEdit={canEdit} onClick={()=>setActiveStageId(row.id)}/>} contact={row=><RepairContactPresentation orderId={row.id} facts={row.contact} history={row.history} canEdit={canEdit} onClick={()=>setActiveContactId(row.id)}/> }>
    {batchAction&&canEdit?<SupplierBatchDialog key={`${staff.member?.id}:${staff.member?.revision}:${batchAction}`} action={batchAction} onSaved={ids=>{const affected=filteredRepairs.find(row=>ids.includes(row.id))??repairOrders.find(row=>ids.includes(row.id));if(affected)followSaved(affected,"parts",false);setOpenGroups(previous=>({...previous,processing:true,rework:true,purchase:true,ready:true}));}} onClose={()=>setBatchAction(null)}/>:null}
    {stageOrder&&canEdit?<RepairStageDialog order={stageOrder} onSaved={()=>followSaved(stageOrder)} onOrder={()=>{setActiveStageId(null);openShortcut(stageOrder.id,"stage");}} onClose={()=>{setActiveStageId(null);requestAnimationFrame(()=>document.getElementById(`repair-stage-${stageOrder.id}`)?.focus({preventScroll:true}));}}/>:null}
    {contactOrder&&canEdit?<RepairContactDialog order={contactOrder} onSaved={()=>followSaved(contactOrder,"contact")} onClose={()=>{setActiveContactId(null);requestAnimationFrame(()=>document.getElementById(`repair-contact-${contactOrder.id}`)?.focus({preventScroll:true}));}}/>:null}
    <RepairProcurementDialog key={`${staff.member?.id}:${staff.member?.revision}:${activeRepairId??"closed"}`} repairId={activeRepairId} onClose={closeShortcut}/>
  </RepairListBody>;
}
