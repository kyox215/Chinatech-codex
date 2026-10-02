"use client";

import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { SearchCombobox } from "@/components/search-combobox";
import { customerCandidates, normalizeCustomerPhone, type Customer } from "@/lib/customers";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { saveCustomerProfile, useCustomerDirectory } from "./customer-store";
import styles from "./customers.module.css";

export function CustomerProfileForm({ customer, onSaved, onCancel }: { customer?: Customer; onSaved: (phone: string) => void; onCancel: () => void }) {
  const { customers } = useCustomerDirectory();
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const [version,setVersion]=useState(customer?.version??0);
  const deviceDraft=useDeviceDraft(`customer:${customer?.id??"new"}`,{phone,name,email,note,version},value=>{setPhone(value.phone);setName(value.name);setEmail(value.email);setNote(value.note);setVersion(value.version);});
  const candidates = customerCandidates(phone, customers);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setSubmitting(true); setError("");
    try {
      const normalized = normalizeCustomerPhone(phone);
      if (!customer && customers.some(item => item.phone === normalized)) throw new Error("该手机号已有客户档案，请打开现有档案。");
      await saveCustomerProfile({ phone: normalized, name, email, note, updatedAt: intakeRecordTime() }, version);
      await deviceDraft.clear();onSaved(normalized);
    } catch (error) { setError(error instanceof Error ? error.message : "客户资料保存失败，请重试。"); }
    finally { busy.current = false; setSubmitting(false); }
  }
  return <form className={`panel ${styles.profileForm}`} onSubmit={submit}>
    <div className="detail-section__head"><h3>{customer ? "编辑客户资料" : "新建客户"}</h3><button className="icon-button" type="button" onClick={onCancel} aria-label="关闭客户表单"><X size={18} /></button></div>
    <DeviceDraftNotice draft={deviceDraft}/>{customer && version!==(customer.version??0)?<button type="button" className="button button--secondary" onClick={()=>setVersion(customer.version??0)}>保留输入并核对最新版本</button>:null}<div className={styles.formBody}><div className="field-grid">
      {customer ? <label className="field"><span>手机号</span><input value={phone} readOnly aria-readonly="true" /></label> : <SearchCombobox label="手机号" value={phone} onChange={setPhone} required inputMode="tel" maxLength={40} filterOptions={false} placeholder="本地手机号或带区号的号码" options={candidates.map(item => ({ value: item.phone, label: item.phone, detail: item.name || "未填写称呼" }))} emptyText="没有匹配客户，可填写新号码" />}
      <label className="field"><span>客户称呼（选填）</span><input value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
      <label className="field"><span>电子邮件（选填）</span><input type="email" value={email} maxLength={160} inputMode="email" onChange={event => setEmail(event.target.value)} /></label>
      <label className="field field--wide"><span>客户备注（选填）</span><textarea value={note} maxLength={500} rows={3} onChange={event => setNote(event.target.value)} /></label>
    </div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className={styles.formActions}><button className="button button--secondary" type="button" disabled={submitting} onClick={onCancel}>取消</button><button className="button button--primary" type="submit" disabled={submitting}><Check size={17} />{submitting ? "正在保存" : "保存客户资料"}</button></div></div>
  </form>;
}
