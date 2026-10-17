"use client";
import { NavigationLink } from "@/components/navigation-link";
import { useBackendMode } from "@/components/backend-snapshot";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { backendRecovery } from "@/lib/backend/client";
import { OperationRecoveryControls, useOperationReceipt } from "@/components/use-operation-receipt";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type HTMLAttributes, type Ref } from "react";
import { Check, History, Plus, ShieldCheck, UsersRound, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { updateStaffMember,validateStaffMember, permissionLabels, rolePermissions, staffRoles, type StaffMember, type StaffRole, type StaffStatus } from "@/lib/staff";
import { savePreviewMember } from "@/lib/staff-client";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { useStaff } from "./use-staff";
import styles from "./staff-settings.module.css";
const statusLabels={pending:"待核对",active:"有效",disabled:"停用"};
export type StaffDirectoryView={members:StaffMember[];revision:number|null;version:string;resolve:(id:string,signal:AbortSignal)=>Promise<StaffMember>;renderMembers?:(render:(member:StaffMember,attributes?:HTMLAttributes<HTMLElement>&{ref?:Ref<HTMLElement>})=>ReactNode)=>ReactNode;history?:ReactNode};
export function StaffSettings({ onPendingChange,directory }: { onPendingChange?: (pending: boolean) => void;directory?:StaffDirectoryView } = {}) {
  const { t , systemText } = useLanguage();
  const staff = useStaff();
  const formal = useBackendMode();
  const members=directory?.members??staff.data.members,revision=directory?directory.revision:staff.data.revision;
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [openedRevision, setOpenedRevision] = useState(0);
  const [openedVersion,setOpenedVersion]=useState("");const [resolvedMember,setResolvedMember]=useState<StaffMember|null>(null);const [choosing,setChoosing]=useState("");const choice=useRef<AbortController|null>(null);
  const ownerKey=JSON.stringify([staff.member?.id,staff.member?.revision,staff.member?.permissions,directory?.version]);const lookupOwner=useRef(ownerKey);
  useLayoutEffect(()=>{if(lookupOwner.current!==ownerKey){lookupOwner.current=ownerKey;choice.current?.abort();choice.current=null;setChoosing("");}},[ownerKey]);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const receipt = useOperationReceipt();
  const pending = submitting || receipt.waiting;
  const existing = directory&&openedVersion===directory.version&&resolvedMember?.id===editing?.id?resolvedMember:members.find(member=>member.id===editing?.id);
  const staleIdentity = Boolean(formal && editing?.revision && (!existing || editing.name !== existing.name || editing.email !== existing.email || editing.accountStatus !== existing.accountStatus));
  const needsReview = openedRevision !== revision || Boolean(directory&&openedVersion!==directory.version) || staleIdentity;
  const attempt = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; attempt.current = null;choice.current?.abort(); }; }, []);
  const deviceDraft = useDeviceDraft("staff-editor", { editing, openedRevision }, value => {
    if (busy.current) return;
    setEditing(value.editing); setOpenedRevision(value.openedRevision); setReview(false); setError("");
  }, Boolean(editing));

  if (!staff.can("staff.manage")) return <div className="module-empty"><ShieldCheck size={28}/><strong>{t("当前账号不能管理员工权限")}</strong></div>;
  async function open(member?: StaffMember) {
    if (busy.current) return;
    if(revision===null){setError("后台资料暂不可用。");return;}
    choice.current?.abort();const controller=new AbortController();choice.current=controller;const owner=lookupOwner.current;
    setError("");if(directory&&member)setChoosing(member.id);
    try{const value=directory&&member?await directory.resolve(member.id,controller.signal):member;if(controller.signal.aborted||choice.current!==controller||owner!==lookupOwner.current||!alive.current)return;
    setEditing(value ? { ...value, permissions: [...value.permissions] } : { id: "DEMO-" + crypto.randomUUID(), name: "", email: "", role: "sales", accountStatus: "active", membershipStatus: "pending", permissions: rolePermissions("sales"), revision: 0 });
    setResolvedMember(value??null);setOpenedRevision(revision);setOpenedVersion(directory?.version??"");setReview(false);
    }catch(reason){if(!controller.signal.aborted&&choice.current===controller)setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}finally{if(choice.current===controller){choice.current=null;setChoosing("");}}
  }
  function close() { if (!busy.current) {choice.current?.abort();choice.current=null;setChoosing("");setEditing(null);} }
  async function reviewLatest() {
    if (busy.current || !editing) return;
    if(revision===null){setError("后台资料暂不可用。");return;}
    const controller=new AbortController();choice.current?.abort();choice.current=controller;const owner=lookupOwner.current;setChoosing(editing.id);
    try{const current=directory?await directory.resolve(editing.id,controller.signal):members.find(row=>row.id===editing.id);if(controller.signal.aborted||choice.current!==controller||owner!==lookupOwner.current||!alive.current)return;
    if (editing.revision && !current) { setError("员工已不存在，请关闭编辑。"); return; }
    setEditing({ ...editing, ...(formal && current ? { name: current.name, email: current.email, accountStatus: current.accountStatus } : {}), revision: current?.revision ?? 0 }); setResolvedMember(current??null);setOpenedRevision(revision);setOpenedVersion(directory?.version??"");setReview(false);setError("");
    }catch(reason){if(!controller.signal.aborted&&choice.current===controller)setError(reason instanceof Error?reason.message:"后台资料暂不可用。");}finally{if(choice.current===controller){choice.current=null;setChoosing("");}}
  }
  const validateName = (value: string) => value.trim() ? "" : "请填写员工称呼，例如小陈；不能只填空格。";
  const validateEmail = (value: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? formal ? "请填写有效的员工账号邮箱，例如 name@example.com。" : "请填写有效的员工账号邮箱，例如 sales@demo.chinatech.local。" : staff.data.members.some(member => member.id !== editing?.id && member.email === value.trim().toLowerCase()) ? "该账号标识已被其他员工使用，请核对邮箱或打开原员工记录。" : "";
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy.current || receipt.isWaiting()) return;
    if(revision===null){setError("后台资料暂不可用。");return;}
    if (needsReview) { setError(formal ? "员工资料或登录身份已变化，请取消后重新核对。" : "员工资料或预览身份已变化，请取消后重新核对。"); return; }
    setError("");
    if (!review) {
      try { if(directory)validateStaffMember({...editing,revision:editing.revision+1});else updateStaffMember(staff.data, editing, openedRevision, staff.member!.id, crypto.randomUUID(), intakeRecordTime()); setReview(true); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，输入已保留，请重试。"); }
      return;
    }
    const requestId = crypto.randomUUID(); attempt.current = requestId;
    busy.current = true; setSubmitting(true); onPendingChange?.(true);
    const ownsAttempt = () => alive.current && attempt.current === requestId;
    const release = () => { if (!ownsAttempt()) return; attempt.current = null; busy.current = false; setSubmitting(false); onPendingChange?.(false); };
    const finish = async () => { if (!ownsAttempt()) return; setSubmitting(true); await deviceDraft.clear(); if (!ownsAttempt()) return; setEditing(null); setReview(false); setError(""); release(); };
    const settle = () => { if (!ownsAttempt()) return; setError(backendRecovery().resolution?.status === "rejected" ? backendRecovery().message : ""); release(); };
    try {
      await savePreviewMember(editing, openedRevision, { requestId });
      await finish();
    } catch (reason) {
      if (ownsAttempt() && !receipt.watch(requestId, () => finish(), settle)) setError(reason instanceof Error ? reason.message : "保存失败，输入已保留，请重试。");
    } finally {
      if (alive.current) { if (!receipt.isWaiting()) release(); setSubmitting(false); }
    }
  }
  const renderMember=(member:StaffMember,attributes?:HTMLAttributes<HTMLElement>&{ref?:Ref<HTMLElement>})=><article key={member.id} {...attributes}><span className={styles.avatar}>{member.name.slice(0,1)}</span><div><strong>{member.name}</strong><small>{member.email}</small><span>{t(staffRoles[member.role])} {t(" · 账号")}{t(statusLabels[member.accountStatus])} {t(" · 成员")}{t(statusLabels[member.membershipStatus])}</span></div><button className="button button--secondary button--compact" type="button" onClick={()=>void open(member)} disabled={pending||member.role==="owner"&&staff.member?.role!=="owner"} aria-busy={choosing===member.id}>{t("编辑")}</button></article>;
  return <>
    <div className={"settings-section-title " + styles.sectionTitle}><UsersRound size={22}/><h3>{t("员工设置")}</h3>{formal ? <NavigationLink className="button button--primary button--compact" href="/app/settings/store">{t("邀请员工")}</NavigationLink> : <button className="button button--primary button--compact" disabled={pending} onClick={() => open()} type="button"><Plus size={17}/>{t("新增员工")}</button>}</div>
    <p className={styles.note}>{t(formal ? "正式门店权限保存在服务器；只能关联已注册并验证邮箱的账号，不创建账号或发送邀请。" : "本地权限演示 · 不创建真实登录或发送邀请，不保存密码。")}</p>
    <fieldset className="form-fields" disabled={pending}><DeviceDraftNotice draft={deviceDraft} disabled={pending}/></fieldset>
    {editing && needsReview ? <button type="button" className="button button--secondary" disabled={pending} onClick={reviewLatest}>{t("保留输入并核对最新版本")}</button> : null}
    {editing ? <form className={styles.editor} onSubmit={save} aria-busy={submitting || receipt.executing}><fieldset className="form-fields" disabled={pending}>
      <div className={styles.heading}><h4>{review ? t("核对员工与权限") : editing.revision ? t("编辑员工") : t(formal ? "新增员工" : "新增DEMO员工")}</h4><button className="icon-button" type="button" aria-label={t("关闭员工编辑")} onClick={close}><X size={18}/></button></div>
      {review ? <div className={styles.review}><strong>{formal && !editing.revision ? t("姓名由已验证账号提供") : editing.name} · {t(staffRoles[editing.role])}</strong><p>{editing.email}</p><p>{t("账号：")}{t(formal && !editing.revision ? "待核对" : statusLabels[editing.accountStatus])} {t(" · 门店成员：")}{t(statusLabels[editing.membershipStatus])}</p><ul>{editing.permissions.map(permission => <li key={permission}>{t(permissionLabels[permission])}</li>)}</ul><p>{t(formal ? "确认后保存本门店的成员状态与权限；账号身份由服务器核对，业务操作仍检查当前权限。" : "权限立即用于当前浏览器的预览；已有业务确认页将重新核对。")}</p></div> : <>
        <div className="field-grid">
          <label className="field"><span>{t(formal ? "账号姓名（核对用）" : "员工称呼 *")}</span><InputControl onClear={() => { setEditing({ ...editing, name: "" }); setError(""); }} clearLabel={t("清空员工称呼")} aria-label={t("员工称呼")} readOnly={formal && Boolean(editing.revision)} required validate={validateName} value={editing.name} maxLength={80} autoComplete="name" onChange={event => { setEditing({ ...editing, name: event.target.value }); setError(""); }} placeholder={t("例如：小陈")} /></label>
          <label className="field"><span>{t(formal ? "员工账号邮箱 *" : "DEMO账号标识 *")}</span><InputControl onClear={() => { setEditing({ ...editing, email: "" }); setError(""); }} clearLabel={t("清空员工账号标识")} aria-label={t("员工账号标识")} readOnly={formal && Boolean(editing.revision)} required type="email" validate={validateEmail} value={editing.email} maxLength={160} autoComplete="email" autoCapitalize="off" onChange={event => { setEditing({ ...editing, email: event.target.value }); setError(""); }} placeholder={formal ? "name@example.com" : "sales@demo.chinatech.local"} /></label>
          <label className="field"><span>{t("角色模板")}</span><SelectControl aria-label={t("员工角色")} value={editing.role} disabled={editing.role === "owner" || editing.id === staff.member?.id} onChange={event => { const role = event.target.value as StaffRole; setEditing({ ...editing, role, permissions: rolePermissions(role) }); }}>{Object.entries(staffRoles).filter(([role]) => role !== "owner" || editing.role === "owner").map(([role, label]) => <option key={role} value={role}>{t(label)}</option>)}</SelectControl></label>
          {(["accountStatus", "membershipStatus"] as const).map(key => <label className="field" key={key}><span>{key === "accountStatus" ? t("账号状态") : t("门店成员状态")}</span><SelectControl aria-label={key === "accountStatus" ? t("员工账号状态") : t("员工成员状态")} disabled={(formal && key === "accountStatus") || editing.id === staff.member?.id || editing.role === "owner" && staff.member?.role !== "owner"} value={formal && !editing.revision && key === "accountStatus" ? "pending" : editing[key]} onChange={event => setEditing({ ...editing, [key]: event.target.value as StaffStatus })}>{Object.entries(statusLabels).map(([status, label]) => <option value={status} key={status}>{t(label)}</option>)}</SelectControl></label>)}
        </div>
        <fieldset className={styles.permissions}><legend>{t("允许的操作")}</legend>{Object.entries(permissionLabels).map(([permission, label]) => <label key={permission}><input type="checkbox" aria-label={t(label)} checked={editing.permissions.includes(permission as keyof typeof permissionLabels)} disabled={editing.id === staff.member?.id || editing.role === "owner" || !staff.can(permission as keyof typeof permissionLabels)} onChange={event => { const next = event.target.checked ? [...editing.permissions, permission as keyof typeof permissionLabels] : editing.permissions.filter(value => value !== permission); setEditing({ ...editing, permissions: next }); }}/><span>{t(label)}</span></label>)}</fieldset>
      {formal ? <p className={styles.note}>{t("保存时使用已验证账号的身份资料；此处填写不会修改账号姓名或邮箱。")}</p> : null}</>}
      {error || needsReview ? <p className="form-error" role="alert">{needsReview ? t(formal ? "员工资料或登录身份已变化，请取消后重新核对。" : "员工资料或预览身份已变化，请取消后重新核对。") : systemText(error)}</p> : null}
      <footer className={styles.footer}><button className="button button--secondary" type="button" onClick={close}>{t("取消")}</button>{review ? <button className="button button--secondary" type="button" onClick={() => { if (!busy.current) setReview(false); }}>{t("返回修改")}</button> : null}<button className="button button--primary" type="submit" disabled={needsReview}><Check size={17}/>{submitting ? t("正在保存…") : receipt.waiting ? t("待核对") : review ? t("确认保存员工") : t("继续核对权限")}</button></footer>
    </fieldset></form> : null}
    <OperationRecoveryControls requestId={receipt.requestId}/>
    {error&&!editing?<p className="form-error" role="alert">{systemText(error)}</p>:null}
    <div className={styles.rows}>{directory?.renderMembers?directory.renderMembers(renderMember):members.map(member=>renderMember(member))}</div>
    {directory?directory.history:<details className={styles.audit}><summary><History size={17}/>{t("权限变更记录 · ")}{staff.data.audit.length}</summary>{staff.data.audit.toReversed().map(entry => <article key={entry.id}><strong>{staff.data.members.find(member => member.id === entry.targetId)?.name || t("员工")} · {entry.before ? t("权限资料更正") : t("新增成员")}</strong><small>{entry.time} · {entry.actorName}</small><p>{entry.after.permissions.map(permission => permissionLabels[permission]).join("、") || t("无业务能力")}</p></article>)}</details>}
  </>;
}
