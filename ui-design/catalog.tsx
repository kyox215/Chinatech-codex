"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardList, Package, RefreshCw, Save, UsersRound, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { NavigationLink } from "@/components/navigation-link";
import { ContentProgress, useActivityFeedback } from "@/components/operation-feedback";
import { InputControl, TextareaControl } from "@/components/input-control";
import { SelectControl } from "@/components/select-control";
import { SearchCombobox } from "@/components/search-combobox";
import { SingleChoice } from "@/components/single-choice";
import { MultiChoice } from "@/components/multi-choice";
import { IdentifierField } from "@/components/identifier-field";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { Toast } from "@/components/toast";
import styles from "./catalog.module.css";

/** Presentation-only DEMO. No business Provider, private configuration, or API. */
export function UIDesignCatalog({ destination = false }: { destination?: boolean }) {
  const { t } = useLanguage();
  const [text, setText] = useState("DEMO"), [note, setNote] = useState("");
  const [choice, setChoice] = useState("screen"), [choices, setChoices] = useState<string[]>(["screen"]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false), [result, setResult] = useState(""), [error, setError] = useState("");
  const [outcome, setOutcome] = useState("success"), [delay, setDelay] = useState("2000");
  const [tab, setTab] = useState("repair");
  const epoch = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useActivityFeedback(busy, { kind: "submit" });
  useEffect(() => () => { epoch.current++; }, []);
  async function save() {
    if (busy) return;
    const own = ++epoch.current;
    setBusy(true); setError(""); setResult("");
    if (outcome === "wait") return;
    await new Promise(resolve => setTimeout(resolve, Number(delay)));
    if (own !== epoch.current) return;
    setBusy(false);
    if (outcome === "error") setError("保存失败。");
    else if (outcome === "conflict") setError("工单或配件已变化，输入已保留。");
    else setResult("已保存");
  }
  const options = [{ value: "screen", label: "屏幕" }, { value: "battery", label: "电池" }, { value: "dock", label: "尾插" }];
  return <main className={styles.catalog}><ContentProgress /><header className={styles.heading}><Brand /><div><strong>{t("界面组件预览")}</strong><p>{t("DEMO 演示")}</p></div><LanguageSwitcher /></header>
    <p className={styles.demo}>{t("等待时间仅为模拟，不代表正式网站速度。")}</p>
    <section className={`panel ${styles.section}`}><h1>{destination ? t("工具箱") : t("界面组件预览")}</h1><div className={styles.actions}>
      <NavigationLink className="button button--primary" href={destination ? "/" : "/destination"} icon={<Package size={17} />}>{t(destination ? "返回首页" : "工具箱")}</NavigationLink>
      <NavigationLink href={destination ? "/" : "/destination"}>{t("工作台")}</NavigationLink>
      <NavigationLink className="icon-button" href={destination ? "/" : "/destination"} icon={<UsersRound size={20} />} aria-label={t("客户管理")} />
    </div></section>
    <div className={styles.grid}><section className={`panel ${styles.section}`}><h2>01 · {t("保存")} / {t("状态")}</h2><div className={styles.actions}>
      <button className="button button--primary" type="button" aria-busy={busy} disabled={busy} onClick={() => void save()}><Save size={17} />{t(busy ? "正在保存…" : "保存")}</button>
      <button className="button button--secondary" type="button" aria-busy={busy} disabled={busy} onClick={() => void save()}>{t("刷新")}</button>
      <button className="button button--secondary" type="button" onClick={() => { epoch.current++; setBusy(false); setError(""); setResult(""); }}>{t("取消")}</button>
    </div><div className={styles.fields}><label className="field"><span>{t("模拟等待时间")}</span><SelectControl value={delay} onChange={event => setDelay(event.target.value)}><option value="200">{t("{v0} 秒", { v0: "0.2" })}</option><option value="2000">{t("{v0} 秒", { v0: "2" })}</option><option value="5000">{t("{v0} 秒", { v0: "5" })}</option></SelectControl></label><label className="field"><span>{t("状态")}</span><SelectControl value={outcome} onChange={event => setOutcome(event.target.value)}><option value="success">{t("已保存")}</option><option value="error">{t("保存失败。")}</option><option value="conflict">{t("待核对")}</option><option value="wait">{t("正在处理…")}</option></SelectControl></label></div>
      {result ? <Toast message={t(result)} onDismiss={() => setResult("")} /> : null}
      {error ? <div className="read-failure" role="alert"><p>{t(error)}</p><button className="button button--secondary" type="button" disabled={busy} onClick={() => void save()}><RefreshCw size={16} />{t("重试")}</button></div> : null}
    </section>
    <section className={`panel ${styles.section}`}><h2>02 · {t("客户资料")}</h2><div className={styles.fields}><label className="field"><span>{t("客户称呼（选填）")}</span><InputControl aria-label={t("客户称呼（选填）")} value={text} onChange={event => setText(event.target.value)} onClear={() => setText("")} clearLabel={t("清空客户称呼（选填）")} disabled={busy} /></label><label className="field"><span>{t("备注")}</span><TextareaControl aria-label={t("备注")} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></label><IdentifierField label="SN / IMEI" value="DEMO-0001" onChange={() => {}} readOnly /><label className="field"><span>{t("电话")}</span><InputControl aria-label={t("电话")} value="DEMO" error={t("格式不符合要求，请按此字段的示例修改。")} onChange={() => {}} /></label></div></section>
    <section className={`panel ${styles.section}`}><h2>03 · {t("选择配件")}</h2><SearchCombobox label={t("维修项")} value={query} onChange={setQuery} options={options.map(option => ({ ...option, label: t(option.label) }))} /><SingleChoice label="维修项" value={choice} options={options} onChange={setChoice} /><MultiChoice label="配件要求" values={choices} options={options} onChange={setChoices} /></section>
    <section className={`panel ${styles.section}`}><h2>04 · {t("工单详情")}</h2><div className={styles.tabs} role="tablist">{[{ id: "repair", label: "维修" }, { id: "supplier", label: "供应商" }, { id: "photos", label: "照片" }, { id: "history", label: "历史" }].map(item => <button type="button" role="tab" key={item.id} aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{t(item.label)}</button>)}</div><div className={styles.facts}><ClipboardList size={22} /><strong>DEMO-0001</strong><span>{t("维修中")}</span></div><div className={styles.table}><div><span>{t("维修项")}</span><span>{t("供应商")}</span><span>{t("报价")}</span></div><div><strong>{t("屏幕")}</strong><span>{t("演示供应商")}</span><span>€90.00</span></div><div><strong>{t("电池")}</strong><span>{t("演示供应商")}</span><span>€60.00</span></div></div><div className={styles.actions}><button className="button button--secondary" type="button" ref={trigger} onClick={() => dialog.current?.showModal()}>{t("核对")}</button><span className="status-pill status-pill--progress">{t("维修中")}</span><span className="status-pill status-pill--success"><Check size={14} />{t("已保存")}</span></div></section></div>
    <dialog ref={dialog} className="repair-parts-dialog" aria-label={t("核对")} onClose={() => trigger.current?.focus()}><header><h2>{t("核对")}</h2><button className="icon-button" type="button" aria-label={t("关闭")} onClick={() => dialog.current?.close()}><X size={20} /></button></header><p>{t("DEMO 演示")} · {text}</p><footer><button className="button button--secondary" type="button" onClick={() => dialog.current?.close()}>{t("取消")}</button><button className="button button--primary" type="button" onClick={() => dialog.current?.close()}>{t("确认")}</button></footer></dialog>
  </main>;
}
