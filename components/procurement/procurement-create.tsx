"use client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";

import{useBackendState}from"@/components/backend-snapshot";
import{backendScopeKey}from"@/lib/backend/read-plan";
import{requestProcurementBatch}from"./procurement-read-client";
import{SearchCombobox}from"@/components/search-combobox";
import{useActivityFeedback}from"@/components/operation-feedback";
import type{ProcurementRepairCandidate}from"@/lib/backend/procurement-batch-contract";
import { backendSnapshot,backendRecovery } from "@/lib/backend/client";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { NavigationLink as Link } from "@/components/navigation-link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { useStoreRouter as useRouter } from "@/components/use-store-router";
import { useEffect, useRef, useState } from "react";
import { PackageSearch, Plus } from "lucide-react";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { validateProcurementDraft, type ProcurementRecord } from "@/lib/procurement";
import { useProcurement } from "./procurement-provider";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";

export function ProcurementCreate({ initialRepairId = "" }: { initialRepairId?: string }) {
  const { t, systemText } = useLanguage();
  const staff=useStaff(),canView=staff.can("repairs.view");const canEdit = staff.can("repairs.edit");const canCost=staff.can("financial.read")&&staff.can("financial.edit");
  const router = useRouter();
  const backend=useBackendState(),bounded=backend.formal&&Boolean(backend.snapshot?.procurementListEnabled),scope=backend.snapshot?.read?.scope,scopeKey=scope?backendScopeKey(scope):"";
  const[open,setOpen]=useState(false),[query,setQuery]=useState(""),[candidateState,setCandidateState]=useState<{key:string;pending:boolean;error:string;items:ProcurementRepairCandidate[]}>({key:"",pending:false,error:"",items:[]});
  const candidateKey=JSON.stringify([scopeKey,query]),candidates=candidateState.key===candidateKey?candidateState.items:[],candidatePending=open&&candidateState.key===candidateKey&&candidateState.pending,candidateError=candidateState.key===candidateKey?candidateState.error:"";
  const[selected,setSelected]=useState<{scope:string;item:ProcurementRepairCandidate}|null>(null);
  const preselected=selected?.scope===scopeKey?selected.item:backend.snapshot?.procurementRepairCandidate;
  useActivityFeedback(candidatePending,{kind:"read"});
  useEffect(()=>{
    if(!bounded||!scope||!open||!canView)return;
    const controller=new AbortController();let live=true;
    const timer=setTimeout(()=>{setCandidateState({key:candidateKey,pending:true,error:"",items:[]});void requestProcurementBatch(scope,{kind:"repairs",q:query,repairId:"",supplierId:""},{signal:controller.signal}).then(value=>{if(live)setCandidateState({key:candidateKey,pending:false,error:"",items:value.items as ProcurementRepairCandidate[]});}).catch(reason=>{if(live&&!controller.signal.aborted)setCandidateState({key:candidateKey,pending:false,error:reason instanceof Error?reason.message:"后台资料暂不可用。",items:[]});});},150);
    return()=>{live=false;clearTimeout(timer);controller.abort();setCandidateState(current=>current.key===candidateKey?{...current,pending:false}:current);};
  },[bounded,scope,scopeKey,open,query,candidateKey,canView]);
  const repairOrders = useRepairDirectory();
  const { dispatch, feedback } = useProcurement();
  const [pending, setPending] = useState("");
  const receipt = useOperationReceipt();
  const [submittingBase, setSubmitting] = useState(false);
  const submitting = submittingBase || receipt.waiting; const busy = useRef(false);
  useEffect(() => { if (!bounded && canEdit && pending && feedback?.recordId === pending && !feedback.error) router.push(`/app/procurement/${pending}`); }, [bounded,canEdit, pending, feedback, router]);
  const [repairId, setRepairId] = useState(initialRepairId);
  const [item, setItem] = useState("");
  const [supplier, setSupplier] = useState("");
  const [required, setRequired] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    const requestId = crypto.randomUUID();
    event.preventDefault();
    if (!canEdit || busy.current || receipt.isWaiting()) return;
    if (pending && !feedback?.error) return;
    const expectedScope=scopeKey,isCurrent=()=>receipt.isActive()&&(!bounded||Boolean(backendSnapshot()?.read?.scope)&&backendScopeKey(backendSnapshot()!.read!.scope)===expectedScope);
    const confirmed=()=>{const result=backendRecovery().receipt;if(result?.requestId!==requestId||!result.entityId)return false;if(isCurrent())router.push(`/app/procurement/${result.entityId}`);return true;};
    busy.current=true;setSubmitting(true);setError("");
    try {
      if(bounded){if(!scope)throw new Error("后台资料暂不可用。");const value=await requestProcurementBatch(scope,{kind:"repairs",q:"",repairId,supplierId:""},{signal:AbortSignal.timeout(15000)});if(!isCurrent())return;if(!repairId||!value.items.some(row=>row.id===repairId))throw new Error("请选择已有的关联工单。");}
      else if (!repairOrders.some((row) => row.id === repairId)) throw new Error("请选择已有的关联工单。");
      if (cost.trim() && !/^\d+(\.\d{1,2})?$/.test(cost.trim())) throw new Error("单价须为非负金额，最多两位小数；未知时请留空。");
      const record: ProcurementRecord = { id: `PO-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, repairId, required, item: item.trim(), supplier: supplier.trim(), quantity: quantity.trim() ? Number(quantity) : Number.NaN, unitCostCents: canCost && cost.trim() ? Math.round(Number(cost) * 100) : null, expectedAt, reference: "", events: [] };
      validateProcurementDraft(record);
      busy.current = true; setSubmitting(true); setError(""); setPending(record.id);
      await dispatch({ type: "create", record }, {requestId});
      if(bounded&&!confirmed()&&isCurrent()){setPending("");setError("保存结果暂不可用，请重新读取工单后核对。");}
    } catch (error) {
      if(confirmed())return;
      receipt.watch(requestId, () => {confirmed();}, () => {if(isCurrent()){setPending(""); setError("");}});
      if(isCurrent()){setPending("");setError(error instanceof Error ? error.message : "请核对采购资料。");}
    } finally { busy.current = false; setSubmitting(false); }
  }

  const message = pending && feedback?.recordId === pending && feedback.error ? feedback.message : error;
  if (!canEdit) return <AccessPanel />;
  return <main className="module-page procurement-create"><header className="module-heading"><PageTitle title={t("新建工单采购")} backHref={submitting ? undefined : "/app/procurement"} backLabel={t("返回采购列表")} /></header><form className="panel procurement-create-form" aria-busy={submitting} onSubmit={submit}><fieldset className="form-fields" disabled={submitting}><div className="detail-section__head"><div><span><PackageSearch size={18} /></span><div><h3>{t("采购条目")}</h3></div></div><span className="status-pill status-pill--warning">{t("草稿")}</span></div>{message ? <div className="procurement-feedback procurement-feedback--error" role="alert">{systemText(message)}</div> : null}<div className="field-grid">
      {bounded?<SearchCombobox className="field--wide" label={t("关联工单")} required maxLength={160} value={repairId} onChange={value=>{setRepairId(value);const item=candidates.find(row=>row.id===value);setSelected(item?{scope:scopeKey,item}:null);}} onQueryChange={setQuery} onOpenChange={setOpen} commitOnBlur showAllOnOpen filterOptions={false} loading={candidatePending} loadingLabel="正在读取工单…" error={candidateError} options={[...(preselected&&!query.trim()&&preselected.id===repairId&&!candidates.some(row=>row.id===repairId)?[preselected]:[]),...candidates].map(row=>({value:row.id,label:row.id,detail:row.model??undefined}))} emptyText="请选择已有的关联工单。" placeholder={t("请选择工单")}/>:<label className="field field--wide"><span>{t("关联工单 *")}</span><SelectControl required aria-label={t("关联工单")} value={repairOrders.some(row => row.id === repairId) ? repairId : ""} onChange={(event) => setRepairId(event.target.value)}><option value="">{t("请选择工单")}</option>{repairOrders.map((repair) => <option value={repair.id} key={repair.id}>{repair.id} · {repair.device.model}</option>)}</SelectControl></label>}
      <label className="field"><span>{t("配件名称 *")}</span><InputControl onClear={() => setItem("")} clearLabel={t("清空配件名称")} required validate={value => value.trim() ? "" : "请填写具体配件名称。"} aria-label={t("配件名称")} value={item} maxLength={100} onChange={(event) => setItem(event.target.value)} placeholder={t("准确的配件名称与适配型号")} /></label>
      <label className="field"><span>{t("供应商 *")}</span><InputControl onClear={() => setSupplier("")} clearLabel={t("清空供应商")} required validate={value => value.trim() ? "" : "请填写供应商名称。"} aria-label={t("供应商")} value={supplier} maxLength={100} onChange={(event) => setSupplier(event.target.value)} placeholder={t("例如 MobileParts SRL")} /></label>
      <label className="field"><span>{t("配件用途")}</span><SelectControl aria-label={t("配件用途")} value={required ? "required" : "optional"} onChange={(event) => setRequired(event.target.value === "required")}><option value="required">{t("本单必需配件")}</option><option value="optional">{t("备选配件，不阻塞本单")}</option></SelectControl></label>
      <label className="field"><span>{t("采购数量 *")}</span><InputControl required min={1} max={10000} aria-label={t("采购数量")} type="number" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {canCost ? <label className="field"><span>{t("采购单价（€，选填）")}</span><InputControl validate={value => !value.trim() || /^\d+(\.\d{1,2})?$/.test(value.trim()) ? "" : "单价须为非负金额，最多两位小数；未知时请留空。"} aria-label={t("采购单价")} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder={t("未知请留空")} /></label> : null}
      <label className="field"><span>{t("预计到货日期（选填）")}</span><InputControl aria-label={t("预计到货日期")} type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} /></label>
    </div><div className="procurement-create-form__footer"><Link className="button button--secondary" aria-disabled={submitting} onClick={event => { if (busy.current || receipt.isWaiting()) event.preventDefault(); }} href="/app/procurement">{t("取消")}</Link><button className="button button--primary" type="submit"><Plus size={17} />{submitting ? t("正在保存…") : t("创建采购草稿")}</button></div></fieldset><OperationRecoveryControls requestId={receipt.requestId}/></form></main>;
}
