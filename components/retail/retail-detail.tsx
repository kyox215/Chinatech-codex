"use client";
import { useLanguage } from "@/components/language-provider";
import { TextareaControl } from "@/components/input-control";

import { useStaff } from "@/components/staff/use-staff";
import { RetailReservation } from "./retail-commerce";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { useRef, useState } from "react";
import { Boxes, CheckCircle2, ClipboardCheck, Database, ShieldCheck, ShoppingBag, Pause } from "lucide-react";
import { RetailCheckoutForm } from "./retail-checkout";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { applyRetailCommand, parseRetailMoney, type Inspection, type RetailCommand, type RetailUnit } from "@/lib/retail";
import { useRetailHistory } from "./retail-history-store";
import { historyDisplayUnit, isSoldSource } from "@/lib/retail-record";
import { historyReturnHref } from "./retail-history-shared";
import { RetailRecordPreparation, RetailRecordOriginalSale } from "./retail-record-preparation";
import { useRetail } from "./retail-provider";
import { RetailDetailView } from "./retail-detail-view";
import { RetailOperationConfirmation, type PendingRetailOperation } from "./retail-operation-confirmation";
import { retailInspectionDetail } from "@/lib/retail-workflow";
import { RetailMoneyControl } from "./retail-input-controls";
import saleStyles from "./retail-sale.module.css";
import styles from "./retail-detail.module.css";
import surface from "./retail-surface.module.css";

const inspectionLabels: Record<keyof Inspection, string> = { functional: "功能检测已完成", ownership: "所有权及账号锁核验已完成", data: "数据处理核验已完成" };
const inspectionItems = [
  { key: "functional", label: "功能检测", icon: ClipboardCheck },
  { key: "ownership", label: "所有权及账号锁核验", icon: ShieldCheck },
  { key: "data", label: "数据处理核验", icon: Database },
] as const;

function RetailActions({ unit }: { unit: RetailUnit }) {
  const { t, systemText } = useLanguage();
  const { dispatch, feedback, ready, error } = useRetail();
  const staff=useStaff();
  const [saleOpen, setSaleOpen] = useState(false);
  const saleTrigger = useRef<HTMLElement | null>(null);
  const operationTrigger = useRef<HTMLElement | null>(null);
  const [checks, setChecks] = useState(unit.inspection);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<PendingRetailOperation | null>(null);
  const [parseError, setParseError] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [version, setVersion] = useState(unit.version);
  const conflict = version !== unit.version;
  const currentFeedback = feedback?.id === unit.id ? feedback : null;
  if (unit.status === "sold") return null;
  function act(command: RetailCommand, title: string, trigger: HTMLElement) {
    operationTrigger.current = trigger;
    setParseError("");
    try {
      if (!reason.trim()) throw new Error("请填写检测说明或变更原因。");
      const event = { id: crypto.randomUUID(), title, detail: reason, time: intakeRecordTime() };
      const updated = applyRetailCommand(unit, command, event, unit.version);
      setPending({ command, event, version: unit.version, nextStatus: updated.status });
    } catch (reason) { setParseError(reason instanceof Error ? reason.message : "请核对资料。"); }
  }
  async function saveInspection(publish: boolean) {
    if (busy.current) return;
    setParseError("");
    try {
      if (conflict) throw new Error("单机已变化，请重新核对。");
      const event = { id: crypto.randomUUID(), title: publish ? "明确设为可售" : "本轮检测已记录", detail: retailInspectionDetail(checks,reason), time: intakeRecordTime() };
      const priceCents = publish && (unit.priceCents === null || unit.priceCents <= 0) ? parseRetailMoney(price) : undefined;
      if (publish && priceCents !== undefined && (priceCents === null || priceCents <= 0)) throw new Error("请先确认有效售价。");
      busy.current = true; setSaving(true);
      const saved = publish ? await dispatch({type:"workflow",workflow:{type:"inspect_approve",id:unit.id,version,checks,note:reason,...(priceCents === undefined ? {} : {priceCents:priceCents!})},event}) : await dispatch({type:"command",id:unit.id,version,command:{type:"inspect",checks,note:reason},event});
      if (saved) { setVersion(version + (publish ? priceCents === undefined ? 2 : 3 : 1)); setReason(""); }
    } catch (cause) { setParseError(cause instanceof Error ? cause.message : "请核对资料。"); }
    finally { busy.current = false; setSaving(false); }
  }
  return <section className={`panel retail-actions ${styles.actions}`}><div className={`detail-section__head ${surface.sectionHead}`}><div><span><ShieldCheck size={18} /></span><div><h3>{t("检测与销售")}</h3></div></div></div>{parseError || currentFeedback ? <div className={`procurement-feedback${parseError || currentFeedback?.error ? " procurement-feedback--error" : ""}`} role={parseError || currentFeedback?.error ? "alert" : "status"}>{systemText(parseError || currentFeedback?.message || "")}</div> : null}<div className={`retail-actions__body ${styles.actionBody}`}>
    {unit.status !== "inspecting" ? <dl className={styles.inspectionSummary} aria-label={t("已保存核验记录")}>{inspectionItems.map(({ key, label, icon: Icon }) => <div key={key}><dt><Icon size={15} aria-hidden="true" />{t(label)}</dt><dd>{unit.inspection[key] ? t("已记录") : t("未完成")}</dd></div>)}</dl> : null}
    <>
      {["available","reserved"].includes(unit.status) && staff.can("retail.sell") ? <><button type="button" hidden={saleOpen} className={`button button--primary ${styles.saleButton} ${saleStyles.trigger}`} disabled={!ready || !!error} onClick={event => { saleTrigger.current = event.currentTarget; setSaleOpen(true); }}><ShoppingBag size={17} />{t("登记售出")}</button>{saleOpen ? <RetailCheckoutForm unit={unit} restoreFocusRef={saleTrigger} onClose={() => setSaleOpen(false)} /> : null}</> : null}<RetailReservation unit={unit}/>
      <fieldset className={"form-fields " + saleStyles.inspectionDraft} disabled={saving} hidden={Boolean(pending)}>{conflict ? <button type="button" className="button button--secondary" onClick={() => {setVersion(unit.version);setChecks({functional:false,ownership:false,data:false});setParseError("");}}>{t("保留输入并核对最新版本")}</button> : null}
      {unit.status === "inspecting" && staff.can("retail.inspect") ? <fieldset className={`retail-inspection-checks ${styles.inspectionChecks}`}><legend>{t("本轮检测确认")}</legend>{inspectionItems.map(({ key, label, icon: Icon }) => <label className={`retail-check ${styles.inspectionCheck}`} key={key}><input type="checkbox" aria-label={t(inspectionLabels[key])} checked={checks[key]} onChange={(event) => setChecks((previous) => ({ ...previous, [key]: event.target.checked }))} /><Icon size={17} aria-hidden="true" /><span>{t(label)}</span><span className={`${styles.savedCheck}${unit.inspection[key] ? ` ${styles.savedCheckDone}` : ""}`}>{unit.inspection[key] ? t("已保存") : t("待检测")}</span></label>)}</fieldset> : null}
      {staff.can("retail.inspect") && ["available","inspecting","hold"].includes(unit.status) ? <><label className="field"><span>{t(unit.status === "inspecting" ? "检测补充说明（选填）" : "检测说明 / 变更原因 *")}</span><TextareaControl aria-label={t("检测说明 / 变更原因")} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)}  placeholder={t("例如：屏幕与充电已测试，账号已退出")} /></label>
      {unit.status === "inspecting" && (unit.priceCents === null || unit.priceCents <= 0) && staff.can("retail.price") ? <RetailMoneyControl label={t("售价")} required value={price} onChange={setPrice} /> : null}<div className={`retail-action-buttons ${styles.actionButtons}`}>{unit.status === "inspecting" ? <><button className="button button--secondary" type="button" disabled={!ready || !!error} onClick={() => void saveInspection(false)}><ClipboardCheck size={17} />{t("记录检测")}</button><button className="button button--primary" type="button" disabled={!ready || !!error} onClick={() => void saveInspection(true)}><CheckCircle2 size={17} />{t("保存检测并设为可售")}</button></> : unit.status === "hold" ? <button className="button button--primary" type="button" disabled={!ready || !!error} onClick={event => act({ type: "reinspect" }, "重新进入检测", event.currentTarget)}><ClipboardCheck size={17} />{t("重新检测")}</button> : null}{unit.status === "inspecting" || unit.status === "available" ? <button className={`button button--secondary ${styles.pauseButton}`} type="button" disabled={!ready || !!error} onClick={event => act({ type: "pause" }, "暂停销售", event.currentTarget)} ><Pause size={17} />{t("暂停销售")}</button> : null}</div>
      <p className="retail-action-note">{t("可单独保存检测；三项完成且有有效售价时，可一次保存并设为可售。")}</p></> : null}
      </fieldset>
    </>
  </div>{pending ? <RetailOperationConfirmation unit={unit} pending={pending} restoreFocusRef={operationTrigger} onClose={() => setPending(null)} /> : null}</section>;
}

export function RetailDetail({ id, selectedSale, returnTo: requestedReturn, showOriginal }: { id: string; selectedSale?: string; returnTo?: string; showOriginal?: boolean }) {
  const { t, systemText } = useLanguage(); const staff = useStaff();
  const { units, returnTo, ready, error } = useRetail(); const history = useRetailHistory();
  const saved = units.find(unit => unit.id === id);
  const original = history.records.find(record => record.id === id && (!saved?.historyOrigin || saved.historyOrigin.sourceSnapshot === record.sourceSnapshot));
  const unit = saved ?? (original ? historyDisplayUnit(original) : undefined);
  const fallback = original && isSoldSource(original) ? "/app/retail?view=sold" : "/app/retail";
  const backHref = historyReturnHref(requestedReturn || (returnTo !== "/app/retail" ? returnTo : fallback));
  const loading = !ready || !history.ready;
  if (loading || !unit || !staff.can("retail.view")) return <main className="module-page"><header className="module-heading"><PageTitle title={t("商品档案")} backHref={backHref} backLabel={t("返回商品列表")} /></header><div className="panel module-empty"><Boxes size={28} /><strong>{loading ? t("正在读取整机记录…") : !staff.can("retail.view") ? t("当前账号无权查看整机记录") : t("没有找到商品档案")}</strong>{error || history.error ? <p role="alert">{systemText(error || history.error)}</p> : null}<Link className="button button--primary" href={backHref}>{t("返回商品列表")}</Link></div></main>;
  return <RetailDetailView key={unit.id + ":" + staff.member?.id + ":" + staff.member?.revision} unit={unit} returnTo={backHref} original={original} showOriginal={showOriginal} sourcePreview={!saved} selectedSale={selectedSale} storageError={error || history.error}>{saved ? <RetailActions key={unit.id + ":" + unit.status} unit={unit} /> : original && (isSoldSource(original) ? <RetailRecordOriginalSale record={original} /> : <RetailRecordPreparation key={original.id + ":" + original.sourceSnapshot} record={original} />)}</RetailDetailView>;
}
