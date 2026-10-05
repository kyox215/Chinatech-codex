"use client";
import { useLanguage } from "@/components/language-provider";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useId, useRef, useState } from "react";
import { isBackendClient } from "@/lib/backend/client";
import { Check, PenLine, RotateCcw, Trash2, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useStaff } from "@/components/staff/use-staff";
import { intakeRecordTime, intakeSignatureSnapshot, matchingIntakeSignature, validSignatureStrokes, type IntakeReceiptData, type IntakePolicy, type IntakeSignatureDraft, type SignatureStrokes } from "@/lib/repair-intake-record";
import { printIssue, printLabel, printAccessories, printServiceRequests, printKnownOrOriginal } from "@/lib/print-language";
import { repairIntakeTermsVersion, repairIntakeTerms, repairIntakeAcknowledgement, repairIntakeStatutoryRights } from "@/lib/repair-print-terms";
import { saveIntakeSignature, useLocalIntakes } from "./local-intake-store";
import styles from "./intake-signature.module.css";

export function SignatureImage({strokes,label,aspectRatio=800/240}:{strokes:SignatureStrokes;label:string;aspectRatio?:number}) {
  const { t } = useLanguage();
  const height=800/aspectRatio;
  return <svg className={styles.image} role="img" aria-label={t(label)} viewBox={`0 0 800 ${height}`}>{strokes.map((stroke,index)=><polyline key={index} points={stroke.map(point=>`${point.x*800},${point.y*height}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>)}</svg>;
}
function SignaturePad({strokes,onChange,aspectRatio,onAspectRatio,disabled=false}:{strokes:SignatureStrokes;onChange:(strokes:SignatureStrokes)=>void;aspectRatio:number|null;onAspectRatio:(ratio:number)=>void;disabled?:boolean}) {
  const { t } = useLanguage();
  const svg=useRef<SVGSVGElement>(null);
  const active=useRef<number|null>(null);
  const working=useRef<SignatureStrokes>(strokes);
  const [cursor,setCursor]=useState({x:0.2,y:0.5});
  const [keyboardDrawing,setKeyboardDrawing]=useState(false);
  const [error,setError]=useState("");
  const description=useId();
  const height=800/(aspectRatio??800/240);
  function publish(next:SignatureStrokes){working.current=next;onChange(next);}
  function start(point:{x:number;y:number}){
    if(strokes.length>=80){setError("笔画较多，请清除后重新签署。");return false;}
    if(aspectRatio===null && svg.current){const bounds=svg.current.getBoundingClientRect();onAspectRatio(bounds.width/bounds.height);}
    working.current=strokes;publish([...strokes,[point]]);return true;
  }
  function add(point:{x:number;y:number}) {
    const all=working.current;const last=all.at(-1);if(!last)return;
    if(all.reduce((sum,stroke)=>sum+stroke.length,0)>=3000 || last.length>=1000){setError("笔迹已达长度上限，请结束本笔或重新签署。");return;}
    if(Math.hypot(point.x-last.at(-1)!.x,point.y-last.at(-1)!.y)<0.001)return;
    publish([...all.slice(0,-1),[...last,point]]);
  }
  function end(){if(working.current.at(-1)?.length===1)publish(working.current.slice(0,-1));active.current=null;setKeyboardDrawing(false);}
  function point(event:React.PointerEvent<SVGSVGElement>){
    const target=event.currentTarget;const matrix=aspectRatio===null?null:target.getScreenCTM();
    if(matrix){const local=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:Math.max(0,Math.min(1,local.x/800)),y:Math.max(0,Math.min(1,local.y/height))};}
    const bounds=target.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))};
  }
  return <div className={styles.pad}>
    <svg ref={svg} className={styles.canvas} viewBox={`0 0 800 ${height}`} preserveAspectRatio={aspectRatio===null?"none":"xMidYMid meet"} tabIndex={disabled?-1:0} aria-disabled={disabled} role="application" aria-label={t("客户手写签字区域")} aria-describedby={description}
      onPointerDown={event=>{if(disabled || !event.isPrimary || event.button!==0 || active.current!==null)return;event.preventDefault();if(start(point(event))){active.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}}
      onPointerMove={event=>{if(disabled)return;if(active.current===event.pointerId)add(point(event));}}
      onPointerUp={event=>{if(active.current===event.pointerId){add(point(event));end();}}}
      onPointerCancel={()=>{if(active.current!==null){publish(working.current.slice(0,-1));end();}}}
      onBlur={()=>{if(keyboardDrawing)end();}}
      onKeyDown={event=>{if(disabled)return;if(event.key===" "){event.preventDefault();if(keyboardDrawing)end();else if(start(cursor))setKeyboardDrawing(true);return;}const move={ArrowLeft:[-0.012,0],ArrowRight:[0.012,0],ArrowUp:[0,-0.025],ArrowDown:[0,0.025]}[event.key];if(move){event.preventDefault();const next={x:Math.max(0,Math.min(1,cursor.x+move[0])),y:Math.max(0,Math.min(1,cursor.y+move[1]))};setCursor(next);if(keyboardDrawing)add(next);}}}>
      <line x1="24" y1={height*.79} x2="776" y2={height*.79} className={styles.baseline}/>
      {!strokes.length?<text x="400" y={height/2} textAnchor="middle" className={styles.placeholder}>{t("在此签字")}</text>:null}
      {strokes.map((stroke,index)=><polyline key={index} points={stroke.map(point=>`${point.x*800},${point.y*height}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>)}
      <circle cx={cursor.x*800} cy={cursor.y*height} r={keyboardDrawing?4:3} className={styles.cursor}/>
    </svg>
    <div className={styles.tools}><span>{t("手指 · 触笔 · 鼠标")}</span><button className="button button--secondary button--compact" type="button" disabled={disabled || !strokes.length} onClick={()=>{end();publish(strokes.slice(0,-1));setError("");}}><RotateCcw size={16}/>{t("撤销一笔")}</button><button className="button button--secondary button--compact" type="button" disabled={disabled || !strokes.length} onClick={()=>{end();publish([]);setError("");}}><Trash2 size={16}/>{t("清除")}</button></div>
    <details className={styles.help}><summary>{t("键盘签字方式")}</summary><p id={description}>{t("聚焦签字区域后按空格开始或结束一笔，方向键移动和绘制。")}{isBackendClient()?t("签名随工单保存。"):t("签名保存在当前浏览器。")}</p></details>{error?<p className="form-error" role="alert">{t(error)}</p>:null}
  </div>;
}
export function IntakeSignatureEditor({data,policy,onConfirm,onCancel}:{data:IntakeReceiptData;policy:IntakePolicy;onConfirm:(draft:IntakeSignatureDraft)=>void|Promise<void>;onCancel:()=>void}) {
  const { t } = useLanguage();
  const [language,setLanguage]=useState<"it"|"en"|"zh">("it");
  const [strokes,setStrokes]=useState<SignatureStrokes>([]);
  const [aspectRatio,setAspectRatio]=useState<number|null>(null);
  const [accepted,setAccepted]=useState(false);
  const [error,setError]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const busy=useRef(false);
  const identity=useRef("");
  const signedAt=useRef("");
  const [snapshot]=useState(()=>intakeSignatureSnapshot(data,policy));
  const issue=printIssue(data,language);
  const requests=printServiceRequests(data.services,language);
  const conflict=JSON.stringify(snapshot)!==JSON.stringify(intakeSignatureSnapshot(data,policy));
  const deviceDraft=useDeviceDraft(`signature:${data.id}`,{language,strokes,aspectRatio,snapshot},value=>{if(JSON.stringify(value.snapshot)!==JSON.stringify(snapshot))throw new Error("接机资料已变化，请重新签署。");setLanguage(value.language);setStrokes(value.strokes);setAspectRatio(value.aspectRatio);setAccepted(false);},strokes.length>0);
  async function confirm(){if(busy.current)return;if(!accepted){setError("请让客户阅读并确认接机资料与条款。");return;}if(!validSignatureStrokes(strokes)){setError("请在签字区域完成有效笔迹，或取消跳过签名。");return;}if(conflict){setError("资料已变化，请取消并重新核对签署。");return;}if(!identity.current){identity.current=crypto.randomUUID();signedAt.current=intakeRecordTime();}busy.current=true;setSubmitting(true);setError("");try{await onConfirm({id:identity.current,signedAt:signedAt.current,language,termsVersion:repairIntakeTermsVersion,strokes:structuredClone(strokes),aspectRatio:aspectRatio??800/240,snapshot:snapshot});await deviceDraft.clear();}catch(reason){setError(reason instanceof Error?reason.message:"签名保存失败。");}finally{busy.current=false;setSubmitting(false);}}
  return <section className={styles.editor} aria-busy={submitting} aria-label={t("客户签字")}><DeviceDraftNotice draft={deviceDraft}/><header className={styles.header}><h3><PenLine size={19}/>{t("客户签字")}</h3><button className="icon-button" type="button" aria-label={t("取消签署")} disabled={submitting} onClick={onCancel}><X size={18}/></button></header>
    <label className="field"><span>{t("客户阅读语言")}</span><SelectControl disabled={submitting} aria-label={t("签署阅读语言")} value={language} onChange={event=>{setLanguage(event.target.value as typeof language);setAccepted(false);setStrokes([]);setAspectRatio(null);identity.current="";}}><option value="it">Italiano</option><option value="en">English</option><option value="zh">中文</option></SelectControl></label>
    <div lang={language} className={styles.reading}><p>{repairIntakeAcknowledgement[language]}</p><dl><div><dt>{language==="it"?"Cliente":language==="en"?"Customer":"客户"}</dt><dd>{data.customerName || "—"} · {data.phone}</dd></div><div><dt>{language==="it"?"Dispositivo":language==="en"?"Device":"设备"}</dt><dd>{data.brand} {data.model} · {data.serial || "—"}</dd></div><div><dt>{language==="it"?"Garanzia commerciale":language==="en"?"Commercial warranty":"商家保修"}</dt><dd>{policy.months} {language==="it"?"mesi":language==="en"?"months":"个月"} · {policy.shopName}</dd></div></dl><details><summary>{language==="it"?"Condizioni e dati da verificare":language==="en"?"Terms and intake details":"条款与接机资料"}</summary><dl><div><dt>{printLabel("category",language)}</dt><dd>{printKnownOrOriginal(data.category,language)} · {printKnownOrOriginal(data.color,language)}</dd></div><div><dt>{printLabel("priority",language)}</dt><dd>{printKnownOrOriginal(data.priority,language)}</dd></div>{data.email?<div><dt>Email</dt><dd>{data.email}</dd></div>:null}<div><dt>{printLabel("reportedFault",language)}</dt><dd>{issue.faults.join(" · ") || "—"}</dd></div>{issue.note?<div><dt>{printLabel("originalText",language)}</dt><dd>{issue.note}</dd></div>:null}<div><dt>{printLabel("requested",language)}</dt><dd>{requests.join(" · ") || "—"}</dd></div><div><dt>{printLabel("accessories",language)}</dt><dd>{printAccessories(data.accessories,language)}</dd></div><div><dt>{printLabel("contact",language)}</dt><dd>{policy.address} · {policy.phone}</dd></div></dl><ul>{repairIntakeTerms[language].map(term=><li key={term}>{term}</li>)}</ul><p>{repairIntakeStatutoryRights[language]}</p></details></div>
    <SignaturePad disabled={submitting} strokes={strokes} aspectRatio={aspectRatio} onAspectRatio={setAspectRatio} onChange={value=>{setStrokes(value);if(!value.length)setAspectRatio(null);setError("");}}/>
    <label className={styles.accept} lang={language}><input type="checkbox" disabled={submitting} checked={accepted} onChange={event=>{setAccepted(event.target.checked);setError("");}}/><span>{language==="it"?"Ho verificato i dati di accettazione e letto le condizioni mostrate.":language==="en"?"I have checked the intake details and read the displayed terms.":"已核对接机资料并阅读所显示条款。"}</span></label>
    {error || conflict?<p className="form-error" role="alert">{conflict?t("资料已变化，请取消后重新签署。"):t(error)}</p>:null}<footer className={styles.actions}><button className="button button--secondary" type="button" disabled={submitting} onClick={onCancel}>{t("取消")}</button><button className="button button--primary" type="button" disabled={submitting || conflict} onClick={()=>void confirm()}><Check size={17}/>{submitting?t("正在保存…"):t("确认签名")}</button></footer>
  </section>;
}
export function IntakeSignatureSection({data,embedded=false}:{data:IntakeReceiptData;embedded?:boolean}) {
  const { t } = useLanguage();
  const {settings,ready:settingsReady,error:settingsError}=useStoreSettings();
  const {signatures,ready,error:storageError}=useLocalIntakes();const staff=useStaff();
  const policy=data.policy ?? {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone};
  const history=signatures.filter(signature=>signature.orderId===data.id);
  const current=matchingIntakeSignature(signatures,data,policy);
  const [editing,setEditing]=useState<{data:IntakeReceiptData;policy:IntakePolicy;count:number}|null>(null);
  const [error,setError]=useState("");
  return <section className={`panel ${styles.section}${embedded?` ${styles.embedded}`:""}`} aria-label={t("客户签名")}><header className={styles.header}><h3><PenLine size={18}/>{t("客户签名")}</h3>{staff.can("repairs.edit")?<button className="button button--secondary button--compact" type="button" disabled={!ready || !settingsReady || !!settingsError || !!storageError || !!editing} onClick={()=>{setError("");setEditing({data:structuredClone(data),policy:structuredClone(policy),count:history.length});}}>{current?t("重新签署"):t("添加签名")}</button>:null}</header>
    {current?<><SignatureImage strokes={current.strokes} aspectRatio={current.aspectRatio} label={t("当前接机资料客户签名")}/><small className={styles.note}>{current.signedAt} · {current.language==="it"?"Italiano":current.language==="en"?"English":t("中文")} {t(" · 接机资料核对")}</small></>:<p className={styles.note}>{history.length?t("资料与历史签署内容不同，请重新核对签署。"):t("未签署 · 可在此让客户签字，也可保留纸质签名。")}</p>}
    {editing?<IntakeSignatureEditor data={editing.data} policy={editing.policy} onCancel={()=>{setEditing(null);setError("");}} onConfirm={async draft=>{try{await saveIntakeSignature(editing.data,editing.policy,draft,editing.count);setEditing(null);setError("");}catch(reason){setError(reason instanceof Error?reason.message:"签名保存失败。");throw reason;}}}/>:null}
    {error || settingsError || storageError?<p className="form-error" role="alert">{t(error || settingsError || storageError || "")}</p>:null}
    {history.length?<details className={styles.history}><summary>{t("签署历史 · ")}{history.length}</summary>{history.toReversed().map(signature=><details key={signature.id}><summary>{signature.signedAt} · {signature.language} · {signature.id===current?.id?t("当前资料"):t("历史资料")}</summary><SignatureImage strokes={signature.strokes} aspectRatio={signature.aspectRatio} label={t("历史接机资料签名")}/><p>{signature.snapshot.customerName || "—"} · {signature.snapshot.brand} {signature.snapshot.model} · {signature.snapshot.serial || "—"}</p><p>{signature.snapshot.issue}</p><p>{signature.snapshot.accessories.join(" · ") || t("无随件")}</p><small>{signature.snapshot.policy.shopName} {t(" · 商家保修 ")}{signature.snapshot.policy.months} {t(" 月 · ")}{signature.termsVersion}</small></details>)}</details>:null}
  </section>;
}
