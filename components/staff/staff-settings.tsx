"use client";
import { InputControl } from "@/components/input-control";
import { isBackendClient } from "@/lib/backend/client";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import { Check, History, Plus, ShieldCheck, UsersRound, X } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { updateStaffMember, permissionLabels, rolePermissions, staffRoles, type StaffMember, type StaffRole, type StaffStatus } from "@/lib/staff";
import { savePreviewMember } from "@/lib/staff-client";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { useStaff } from "./use-staff";
import styles from "./staff-settings.module.css";
const statusLabels={pending:"待核对",active:"有效",disabled:"停用"};
export function StaffSettings({ onPendingChange }: { onPendingChange?: (pending: boolean) => void } = {}) {
  const staff = useStaff();
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [openedRevision, setOpenedRevision] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const deviceDraft = useDeviceDraft("staff-editor", { editing, openedRevision }, value => {
    if (busy.current) return;
    setEditing(value.editing); setOpenedRevision(value.openedRevision); setReview(false); setError("");
  }, Boolean(editing));

  if (!staff.can("staff.manage")) return <div className="module-empty"><ShieldCheck size={28}/><strong>当前账号不能管理员工权限</strong></div>;
  function open(member?: StaffMember) {
    if (busy.current) return;
    setEditing(member ? { ...member, permissions: [...member.permissions] } : { id: "DEMO-" + crypto.randomUUID(), name: "", email: "", role: "sales", accountStatus: "active", membershipStatus: "pending", permissions: rolePermissions("sales"), revision: 0 });
    setOpenedRevision(staff.data.revision); setReview(false); setError("");
  }
  function close() { if (!busy.current) setEditing(null); }
  function reviewLatest() {
    if (busy.current || !editing) return;
    const current = staff.data.members.find(row => row.id === editing.id);
    if (editing.revision && !current) { setError("员工已不存在，请关闭编辑。"); return; }
    setEditing({ ...editing, revision: current?.revision ?? 0 }); setOpenedRevision(staff.data.revision); setReview(false); setError("");
  }
  const validateName = (value: string) => value.trim() ? "" : "请填写员工称呼，例如小陈；不能只填空格。";
  const validateEmail = (value: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "请填写有效的员工账号邮箱，例如 sales@demo.chinatech.local。" : staff.data.members.some(member => member.id !== editing?.id && member.email === value.trim().toLowerCase()) ? "该账号标识已被其他员工使用，请核对邮箱或打开原员工记录。" : "";
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy.current) return;
    setError("");
    try {
      if (!review) {
        updateStaffMember(staff.data, editing, openedRevision, staff.member!.id, crypto.randomUUID(), intakeRecordTime());
        setReview(true); return;
      }
      busy.current = true; setSubmitting(true); onPendingChange?.(true);
      await savePreviewMember(editing, openedRevision);
      await deviceDraft.clear(); setEditing(null); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，输入已保留，请重试。"); }
    finally {
      if (busy.current) { busy.current = false; setSubmitting(false); onPendingChange?.(false); }
    }
  }
  return <>
    <div className={"settings-section-title " + styles.sectionTitle}><UsersRound size={22}/><h3>员工设置</h3><button className="button button--primary button--compact" disabled={submitting} onClick={() => open()} type="button"><Plus size={17}/>新增员工</button></div>
    <p className={styles.note}>本地权限演示 · 不创建真实登录或发送邀请，不保存密码。</p>
    <fieldset className="form-fields" disabled={submitting}><DeviceDraftNotice draft={deviceDraft}/></fieldset>
    {editing && openedRevision !== staff.data.revision ? <button type="button" className="button button--secondary" disabled={submitting} onClick={reviewLatest}>保留输入并核对最新版本</button> : null}
    {editing ? <form className={styles.editor} onSubmit={save} aria-busy={submitting}><fieldset className="form-fields" disabled={submitting}>
      <div className={styles.heading}><h4>{review ? "核对员工与权限" : editing.revision ? "编辑员工" : "新增DEMO员工"}</h4><button className="icon-button" type="button" aria-label="关闭员工编辑" onClick={close}><X size={18}/></button></div>
      {review ? <div className={styles.review}><strong>{editing.name} · {staffRoles[editing.role]}</strong><p>{editing.email}</p><p>账号：{statusLabels[editing.accountStatus]} · 门店成员：{statusLabels[editing.membershipStatus]}</p><ul>{editing.permissions.map(permission => <li key={permission}>{permissionLabels[permission]}</li>)}</ul><p>权限立即用于当前浏览器的预览；已有业务确认页将重新核对。</p></div> : <>
        <div className="field-grid">
          <label className="field"><span>员工称呼 *</span><InputControl onClear={() => { setEditing({ ...editing, name: "" }); setError(""); }} clearLabel="清空员工称呼" aria-label="员工称呼" required validate={validateName} value={editing.name} maxLength={80} autoComplete="name" onChange={event => { setEditing({ ...editing, name: event.target.value }); setError(""); }} placeholder="例如：小陈" /></label>
          <label className="field"><span>DEMO账号标识 *</span><InputControl onClear={() => { setEditing({ ...editing, email: "" }); setError(""); }} clearLabel="清空员工账号标识" aria-label="员工账号标识" required type="email" validate={validateEmail} value={editing.email} maxLength={160} autoComplete="email" autoCapitalize="off" onChange={event => { setEditing({ ...editing, email: event.target.value }); setError(""); }} placeholder="sales@demo.chinatech.local" /></label>
          <label className="field"><span>角色模板</span><SelectControl aria-label="员工角色" value={editing.role} disabled={editing.role === "owner" || editing.id === staff.member?.id} onChange={event => { const role = event.target.value as StaffRole; setEditing({ ...editing, role, permissions: rolePermissions(role) }); }}>{Object.entries(staffRoles).filter(([role]) => role !== "owner" || editing.role === "owner").map(([role, label]) => <option key={role} value={role}>{label}</option>)}</SelectControl></label>
          {(["accountStatus", "membershipStatus"] as const).map(key => <label className="field" key={key}><span>{key === "accountStatus" ? "账号状态" : "门店成员状态"}</span><SelectControl aria-label={key === "accountStatus" ? "员工账号状态" : "员工成员状态"} disabled={(isBackendClient() && key === "accountStatus") || editing.id === staff.member?.id || editing.role === "owner" && staff.member?.role !== "owner"} value={editing[key]} onChange={event => setEditing({ ...editing, [key]: event.target.value as StaffStatus })}>{Object.entries(statusLabels).map(([status, label]) => <option value={status} key={status}>{label}</option>)}</SelectControl></label>)}
        </div>
        <fieldset className={styles.permissions}><legend>允许的操作</legend>{Object.entries(permissionLabels).map(([permission, label]) => <label key={permission}><input type="checkbox" aria-label={label} checked={editing.permissions.includes(permission as keyof typeof permissionLabels)} disabled={editing.id === staff.member?.id || editing.role === "owner" || !staff.can(permission as keyof typeof permissionLabels)} onChange={event => { const next = event.target.checked ? [...editing.permissions, permission as keyof typeof permissionLabels] : editing.permissions.filter(value => value !== permission); setEditing({ ...editing, permissions: next }); }}/><span>{label}</span></label>)}</fieldset>
      </>}
      {error || openedRevision !== staff.data.revision ? <p className="form-error" role="alert">{openedRevision !== staff.data.revision ? "员工资料或预览身份已变化，请取消后重新核对。" : error}</p> : null}
      <footer className={styles.footer}><button className="button button--secondary" type="button" onClick={close}>取消</button>{review ? <button className="button button--secondary" type="button" onClick={() => { if (!busy.current) setReview(false); }}>返回修改</button> : null}<button className="button button--primary" type="submit" disabled={openedRevision !== staff.data.revision}><Check size={17}/>{submitting ? "正在保存…" : review ? "确认保存员工" : "继续核对权限"}</button></footer>
    </fieldset></form> : null}
    <div className={styles.rows}>{staff.data.members.map(member => <article key={member.id}><span className={styles.avatar}>{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>{member.email}</small><span>{staffRoles[member.role]} · 账号{statusLabels[member.accountStatus]} · 成员{statusLabels[member.membershipStatus]}</span></div><button className="button button--secondary button--compact" type="button" onClick={() => open(member)} disabled={submitting || member.role === "owner" && staff.member?.role !== "owner"}>编辑</button></article>)}</div>
    <details className={styles.audit}><summary><History size={17}/>权限变更记录 · {staff.data.audit.length}</summary>{staff.data.audit.toReversed().map(entry => <article key={entry.id}><strong>{staff.data.members.find(member => member.id === entry.targetId)?.name || "员工"} · {entry.before ? "权限资料更正" : "新增成员"}</strong><small>{entry.time} · {entry.actorName}</small><p>{entry.after.permissions.map(permission => permissionLabels[permission]).join("、") || "无业务能力"}</p></article>)}</details>
  </>;
}
