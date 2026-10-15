"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useActivityFeedback } from "@/components/operation-feedback";
import { useStaff } from "@/components/staff/use-staff";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import type { IntakeReceiptData } from "@/lib/repair-intake-record";
import { IntakePhotos, useIntakePhotos, type IntakePhoto } from "./intake-photos";
import { saveIntakePhotos } from "./local-intake-store";
import styles from "./repair-detail-workspace.module.css";

export function RepairPhotoRegistry({ data, photos, active = true }: { data: IntakeReceiptData; photos: IntakePhoto[]; active?: boolean }) {
  const { t, systemText } = useLanguage();
  const canEdit = useStaff().can("repairs.edit");
  const draft = useIntakePhotos();
  const receipt = useOperationReceipt();
  const [revision, setRevision] = useState(data.revision ?? 1);
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState<IntakePhoto | null>(null);
  const photoOpener = useRef<HTMLButtonElement | null>(null);
  const closeViewer = () => { setViewing(null); requestAnimationFrame(() => { if (photoOpener.current?.isConnected) photoOpener.current.focus({preventScroll:true}); }); };
  const busy = useRef(false);
  const pending = saving || receipt.waiting;
  useActivityFeedback(saving, { kind: "submit", scope: `repair-photos:${data.id}` });
  const changed = draft.photos.length > 0 && revision !== (data.revision ?? 1);
  async function add(slot: IntakePhoto["slot"], files: File[]) {
    if (pending || !canEdit) return;
    if (!draft.photos.length) setRevision(data.revision ?? 1);
    setSaved(false); await draft.add(slot, files);
  }
  async function save() {
    if (busy.current || receipt.isWaiting() || !canEdit || changed || !draft.photos.length) return;
    busy.current = true; setSaving(true); setError(""); setSaved(false);
    const requestId = crypto.randomUUID();
    const finish = () => { draft.clear(); setError(""); setSaved(true); busy.current = false; };
    try {
      const attachments = await draft.encode();
      if (!receipt.isActive()) return;
      await saveIntakePhotos(data.id, revision, attachments, { requestId });
      if (receipt.isActive()) finish();
    } catch (reason) {
      if (receipt.isActive() && !receipt.watch(requestId, finish, () => { busy.current = false; setError(""); })) setError(reason instanceof Error ? reason.message : "照片登记未保存，草稿已保留。");
    } finally { if (receipt.isActive()) { if (!receipt.isWaiting()) busy.current = false; setSaving(false); } }
  }
  return <section className={`panel ${styles.section}`} aria-label={t("照片登记")}>
    <header className={styles.sectionHead}><h3><ImagePlus size={18}/>{t("接机照片")} <small>{data.photoCount}</small></h3></header>
    <div className={styles.photoGrid}>{photos.map(photo => <button key={photo.id} className={styles.photo} type="button" onClick={event => { photoOpener.current=event.currentTarget; setViewing(photo); }} aria-label={t("查看{v0}照片", { v0: t(photo.slot === "front" ? "正面" : photo.slot === "back" ? "背面" : "其他") })}><Image unoptimized src={photo.url} width={240} height={180} alt={t(photo.slot === "front" ? "正面" : photo.slot === "back" ? "背面" : "其他")}/><span>{t(photo.slot === "front" ? "正面" : photo.slot === "back" ? "背面" : "其他")}</span></button>)}</div>
    {!photos.length ? <p className={styles.note}>{t(data.photoCount ? "旧照片引用待核对，请刷新后重试。" : "尚未登记照片")}</p> : null}
    {canEdit ? <details className={styles.photoDraft} open={draft.photos.length ? true : undefined}><summary>{t("添加或更新照片")}</summary><p className={styles.note}>{t("正面、背面会替换当前展示，旧原件保留；其他照片追加。确认保存后更新数量。")}</p><IntakePhotos {...draft} add={add} disabled={pending}/>
      {changed ? <p role="alert" className="form-error">{t("工单已变化，照片草稿已保留。请核对当前照片后继续。")}<button className="button button--secondary" type="button" disabled={pending} onClick={() => { setRevision(data.revision ?? 1); setError(""); }}>{t("已核对当前照片")}</button></p> : null}
      {draft.photos.length ? <div className={styles.actions}><button className="button button--secondary" type="button" disabled={pending} onClick={() => { draft.clear(); setError(""); }}>{t("放弃照片草稿")}</button><button className="button button--primary" type="button" aria-busy={saving} disabled={pending || changed || draft.pending.length > 0} onClick={() => void save()}>{saving ? t("正在保存…") : receipt.waiting ? t("待核对") : t("保存照片登记")}</button></div> : null}
    </details> : null}
    {error ? <p className="form-error" role="alert">{systemText(error)}</p> : null}
    {saved ? <p role="status" className={styles.note}>{t("照片登记已保存")}</p> : null}
    <OperationRecoveryControls requestId={active ? receipt.requestId : null}/>
    {viewing ? <PhotoViewer photo={viewing} onClose={closeViewer}/> : null}
  </section>;
}

function PhotoViewer({photo,onClose}:{photo:IntakePhoto;onClose:()=>void}) {
  const {t}=useLanguage(); const dialog=useRef<HTMLDialogElement>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading"), [attempt,setAttempt]=useState(0);
  useActivityFeedback(state==="loading",{kind:"read",scope:"repair-photo-viewer"});
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className={`repair-parts-dialog ${styles.photoViewer}`} aria-label={t("接机照片")} onCancel={event=>{event.preventDefault();onClose();}}><header><h3>{t(photo.slot==="front"?"正面":photo.slot==="back"?"背面":"其他")}</h3><button className="icon-button" type="button" onClick={onClose} aria-label={t("关闭照片")}><X size={20}/></button></header>{state==="loading"?<p role="status">{t("正在读取照片…")}</p>:null}{state==="error"?<p className="form-error" role="alert">{t("照片暂时无法读取，请重试。")}<button className="button button--secondary" type="button" onClick={()=>{setState("loading");setAttempt(n=>n+1);}}>{t("重新读取照片")}</button></p>:null}<Image key={attempt} unoptimized src={photo.url} width={1000} height={1000} alt={t("接机照片")} onLoad={()=>setState("ready")} onError={()=>setState("error")}/></dialog>;
}
