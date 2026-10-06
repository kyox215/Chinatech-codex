"use client";
import { useLanguage } from "@/components/language-provider";
import { InputControl, TextareaControl } from "@/components/input-control";
import { useDeviceDraft, DeviceDraftNotice } from "@/components/use-device-draft";
import { useStoreSettings } from "@/components/settings/settings-store";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { IdentifierField } from "@/components/identifier-field";
import { ColorPicker } from "@/components/color-picker";
import { SingleChoice } from "@/components/single-choice";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Copy, Cpu, Package, ShieldCheck, Sparkles } from "lucide-react";
import { changeRetailDraftCategory, copyRetailModel, emptyRetailUnit, hasBattery, isComputer, isRetailVerificationField, normalizeImei, parseRetailMoney, retailCategories, validateRetailUnit, type Inspection, type RetailCategory, type RetailUnit } from "@/lib/retail";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { useRetail } from "./retail-provider";
import { RetailWarrantyControl } from "./retail-warranty-control";
import { RetailCatalogControl, RetailDisksControl, RetailRamControl, RetailStorageControl } from "./retail-spec-controls";
import { RetailDateControl, RetailMoneyControl, RetailNumberControl } from "./retail-input-controls";
import { RetailGallery } from "./retail-gallery";
import styles from "./retail-form.module.css";
import surface from "./retail-surface.module.css";

const emptyChecks: Inspection = { functional: false, ownership: false, data: false };
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { t } = useLanguage();
  return <label className="field"><span>{t(label)}</span><InputControl onClear={() => onChange("")} clearLabel={t("清空{v0}", { v0: t(label) })} aria-label={t(label)} value={value} maxLength={120} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const { t } = useLanguage();
  return <section className={styles.section} data-create-section={id} aria-label={t(title)}><header className={"detail-section__head " + surface.sectionHead}><h3>{t(title)}</h3></header><div className={"field-grid " + styles.fields}>{children}</div></section>;
}
type RetailFormProps = { copyId?: string; identifier?: string; kind?: string };
export function RetailForm(props: RetailFormProps) {
  const { t, systemText } = useLanguage(); const staff = useStaff(); const { ready, error, returnTo } = useRetail(); const store = useStoreSettings();
  if (!staff.ready || !ready || !store.ready) return <main className={"module-page " + surface.page}><PageTitle title={t("新建商品")} backHref={returnTo} backLabel={t("返回商品列表")} /><section className="panel module-empty" role="status">{t("正在读取单机资料…")}</section></main>;
  if (!staff.can("retail.edit")) return <AccessPanel />;
  if (error || store.error) return <main className={"module-page " + surface.page}><PageTitle title={t("新建商品")} backHref={returnTo} backLabel={t("返回商品列表")} /><section className="panel module-empty" role="alert">{systemText(error || store.error)}</section></main>;
  return <RetailFormContent key={staff.member?.id + ":" + staff.member?.revision} {...props} />;
}
function RetailFormContent({ copyId, identifier, kind }: RetailFormProps) {
  const { t, systemText } = useLanguage(); const staff = useStaff(); const { units, returnTo, dispatch, feedback, ready, error: storageError } = useRetail(); const router = useRouter(); const { settings } = useStoreSettings();
  const sourceUnit = units.find(unit => unit.id === copyId);
  const [draft, setDraft] = useState<RetailUnit>(() => {
    const initial = sourceUnit ? copyRetailModel(sourceUnit) : emptyRetailUnit(); initial.warrantyMonths = settings.retailWarrantyMonths;
    const raw = identifier?.trim().slice(0, 150) ?? ""; if (kind === "serial") initial.serial = raw; if (kind === "imei") initial.imei1 = raw; if (kind === "product") initial.productCode = raw; return initial;
  });
  const [goal, setGoal] = useState<"inspecting" | "available">("inspecting");
  const [classificationSelected, setClassificationSelected] = useState(false);
  const [checks, setChecks] = useState<Inspection>(emptyChecks); const [note, setNote] = useState(""); const [photos, setPhotos] = useState<string[]>([]);
  const [cost, setCost] = useState(""); const [refurb, setRefurb] = useState(""); const [price, setPrice] = useState("");
  const [creationId, setCreationId] = useState(() => crypto.randomUUID()); const operationId = useRef(crypto.randomUUID()); const submitting = useRef(false); const [saving, setSaving] = useState(false); const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState(""); const checkRegion = useRef<HTMLElement>(null);
  const canPublish = staff.can("retail.inspect") && staff.can("retail.price");
  const deviceDraft = useDeviceDraft("retail-new:" + (copyId ?? "") + ":" + (identifier ?? ""), { draft, classificationSelected, goal, checks, note, photos, cost, refurb, price, creationId }, value => {
    if (!value.draft?.category || !value.creationId) throw new Error("草稿格式无效。");
    setDraft({ ...value.draft, storeOwned: false }); setClassificationSelected(value.classificationSelected); setGoal(value.goal ?? "inspecting"); setChecks(emptyChecks); setNote(value.note ?? ""); setPhotos(value.photos ?? []); setCost(value.cost); setRefurb(value.refurb); setPrice(value.price); setCreationId(value.creationId);
  });
  function update<K extends keyof RetailUnit>(key: K, value: RetailUnit[K]) {
    if (isRetailVerificationField(key) && JSON.stringify(draft[key]) !== JSON.stringify(value)) setChecks(emptyChecks);
    setDraft(previous => ({ ...previous, [key]: value }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current || photoBusy) return; setError("");
    try {
      if (!classificationSelected) throw new Error("请先选择新机或翻新机。");
      if (goal === "available" && !canPublish) throw new Error("当前账号没有此操作权限。");
      const unit: RetailUnit = { ...draft, id: creationId, code: "", brand: draft.brand.trim(), model: draft.model.trim(), serial: draft.serial.trim(), imei1: normalizeImei(draft.imei1), imei2: normalizeImei(draft.imei2), productCode: draft.productCode.trim(), costCents: staff.can("financial.edit") ? parseRetailMoney(cost) : null, refurbCents: staff.can("financial.edit") ? parseRetailMoney(refurb) : null, priceCents: staff.can("retail.price") ? parseRetailMoney(price) : null };
      validateRetailUnit(unit, units);
      if (goal === "available" && (!checks.functional || !checks.ownership || !checks.data)) throw new Error("功能、所有权与账号、数据处理三项检查必须全部完成。");
      if (goal === "available" && (unit.priceCents === null || unit.priceCents <= 0)) throw new Error("请先确认有效售价。");
      submitting.current = true; setSaving(true);
      const event = { id: operationId.current, title: "新建商品", detail: note, time: intakeRecordTime() };
      const saved = goal === "available" ? await dispatch({ type: "workflow", workflow: { type: "create_ready", unit, photos, checks, note, settingsRevision: settings.revision }, event }) : await dispatch({ type: "create", unit, photos, event: { ...event, detail: "门店自有实物，待检测。" } });
      if (!saved) { submitting.current = false; setSaving(false); return; }
      await deviceDraft.clear().catch(() => undefined); router.push("/app/retail/units/" + creationId);
    } catch (reason) {
      submitting.current = false; setSaving(false); setError(reason instanceof Error ? reason.message : "请核对单机资料。");
      checkRegion.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); checkRegion.current?.focus({ preventScroll: true });
    }
  }
  return <main className={"module-page retail-create " + surface.page + " " + styles.create}>
    <header className="module-heading"><PageTitle title={sourceUnit ? t("同型号新建商品") : t("新建商品")} backHref={saving ? undefined : returnTo} backLabel={t("返回商品列表")} /></header>
    {sourceUnit ? <p className={"inline-notice " + styles.notice}><Copy size={17} /><span>{t("从 ")}{sourceUnit.code}{t(" 复制型号与候选规格；身份、照片、检测、电池、手柄数量、来源与金额均已清空，请逐项核对实物。")}</span></p> : identifier ? <p className={"inline-notice " + styles.notice}>{t("识别文本仅作为待核对字段，不证明机器身份或规格。")}</p> : null}
    <form className={"panel " + styles.form} aria-busy={saving} onSubmit={submit}><fieldset className="form-fields" disabled={saving}>
      <DeviceDraftNotice draft={deviceDraft} />
      <div className={styles.classification}><SingleChoice label={t("商品分类 *")} value={classificationSelected ? draft.condition : ""} options={[{ value: "新机", label: "新机", icon: Package }, { value: "翻新机", label: "翻新机", icon: Sparkles }]} onChange={value => { update("condition", value as RetailUnit["condition"]); setClassificationSelected(true); setError(""); }} /></div>
      {classificationSelected ? <div className={styles.body}><div className={styles.layout}>
        <div className={styles.column}>
          <Section id="identity" title={t("商品身份")}>
            <label className="field"><span>{t("商品类型")}</span><SelectControl aria-label={t("商品类型")} value={draft.category} onChange={event => { if (draft.category !== event.target.value) setChecks(emptyChecks); setDraft(previous => changeRetailDraftCategory(previous, event.target.value as RetailCategory)); }}>{Object.entries(retailCategories).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</SelectControl></label>
            <RetailCatalogControl field="brand" category={draft.category} units={units} label={t("品牌")} value={draft.brand} onChange={value => { if (value !== draft.brand) { setChecks(emptyChecks); setDraft(previous => ({ ...previous, brand: value, model: "" })); } }} />
            <div className={styles.wide}><RetailCatalogControl field="model" category={draft.category} brand={draft.brand} units={units} label={t("型号 / 商品名称")} required value={draft.model} onChange={value => update("model", value)} /></div>
            <IdentifierField label="SN" name="retail-sn" kind="serial" value={draft.serial} onChange={value => update("serial", value)} />
            {["phone", "tablet"].includes(draft.category) ? <IdentifierField label="IMEI 1" name="retail-imei1" kind="imei" value={draft.imei1} onChange={value => update("imei1", value)} /> : null}
            <details className={styles.wide}><summary>{t("更多识别码")}</summary><div className={"field-grid " + styles.extraFields}>{["phone", "tablet"].includes(draft.category) ? <IdentifierField label="IMEI 2" name="retail-imei2" kind="imei" value={draft.imei2} onChange={value => update("imei2", value)} /> : null}<IdentifierField label={t("包装条码")} name="retail-product-code" kind="serial" value={draft.productCode} onChange={value => update("productCode", value)} /></div></details>
          </Section>
          <Section id="physical" title={t("实物状况")}>
            <ColorPicker key={"color-" + draft.category} value={draft.color} onChange={value => update("color", value)} />
            <SingleChoice label={t("外观等级")} value={draft.grade} options={["待评估", "S", "A", "B", "C"].map(value => ({ value, label: value }))} onChange={value => update("grade", value as RetailUnit["grade"])} />
            {hasBattery(draft.category) ? <div className={styles.wide}><RetailNumberControl label={draft.category === "console" ? t("电池健康（适用时）") : t("电池健康")} unit="%" value={draft.batteryPercent} onChange={value => update("batteryPercent", value)} /></div> : null}
            <details className={styles.wide}><summary>{t("问题与随件（选填）")}</summary><div className={styles.extraFields}>
            <label className={"field " + styles.wide}><span>{t("已知问题与外观说明")}</span><TextareaControl aria-label={t("已知问题与外观说明")} value={draft.knownIssues} maxLength={600} onChange={event => update("knownIssues", event.target.value)} /></label>
            <label className={"field " + styles.wide}><span>{t("实际随附物品")}</span><TextareaControl aria-label={t("实际随附物品")} value={draft.accessories} maxLength={600} onChange={event => update("accessories", event.target.value)} /></label>
            </div></details>
            {draft.category === "console" ? <RetailNumberControl label={t("实际随附手柄数量")} value={draft.controllers} onChange={value => update("controllers", value)} /> : null}
            <details className={styles.wide}><summary>{t("照片（选填）")}</summary><RetailGallery unit={{ ...draft, photos }} compact readOnly={saving} onDraftChange={setPhotos} onBusyChange={setPhotoBusy} /><small>{t("照片随商品一起保存。")}</small></details>
          </Section>
          {draft.category !== "other" ? <details className={styles.section}><summary><Cpu size={17} />{t("详细规格（选填）")}</summary><div className={"field-grid " + styles.fields}>
            {["phone", "tablet"].includes(draft.category) ? <RetailRamControl value={draft.ramGb} onChange={value => update("ramGb", value)} /> : null}
            {["phone", "tablet", "console"].includes(draft.category) ? <RetailStorageControl category={draft.category} value={draft.bodyStorage} onChange={value => update("bodyStorage", value)} /> : null}
            {isComputer(draft.category) ? <><RetailRamControl value={draft.ramGb} onChange={value => update("ramGb", value)} /><RetailCatalogControl field="cpu" category={draft.category} units={units} label={t("CPU")} value={draft.cpu} onChange={value => update("cpu", value)} /><RetailCatalogControl field="gpu" category={draft.category} units={units} label={t("GPU")} value={draft.gpu} onChange={value => update("gpu", value)} />{draft.category === "laptop" ? <RetailCatalogControl field="keyboard" category={draft.category} units={units} label={t("键盘布局")} value={draft.keyboard} onChange={value => update("keyboard", value)} /> : null}<div className={styles.wide}><RetailDisksControl category={draft.category} value={draft.disks} onChange={value => update("disks", value)} /></div></> : null}
            {["phone", "tablet", "console"].includes(draft.category) ? <RetailCatalogControl field="edition" category={draft.category} units={units} label={t("版本 / 网络")} value={draft.edition} onChange={value => update("edition", value)} /> : null}
          </div></details> : null}
        </div>
        <div className={styles.column}>
          <section ref={checkRegion} tabIndex={-1} className={styles.section} aria-label={t("售价与检查")}>
            <header className={"detail-section__head " + surface.sectionHead}><div><ShieldCheck size={18} /><h3>{t("售价与检查")}</h3></div></header>
            <div className={"field-grid " + styles.fields}>
              <label className={"field " + styles.wide}><span>{t("保存方式")}</span><SelectControl aria-label={t("保存方式")} value={goal} onChange={event => setGoal(event.target.value as typeof goal)}><option value="inspecting">{t("仅建档，稍后检测")}</option><option value="available" disabled={!canPublish}>{t("建档并设为可售")}</option></SelectControl></label>
              {staff.can("retail.price") ? <RetailMoneyControl label={t("标价")} value={price} onChange={setPrice} required={goal === "available"} /> : null}
              <RetailWarrantyControl value={draft.warrantyMonths} onChange={value => update("warrantyMonths", value)} />
              {goal === "available" ? <fieldset className={"retail-inspection-checks " + styles.wide}><legend>{t("本轮检测确认")}</legend>
                <label className="retail-check"><input type="checkbox" aria-label={t("功能检测已完成")} checked={checks.functional} onChange={event => setChecks(previous => ({ ...previous, functional: event.target.checked }))} /><span>{t("功能检测已完成")}</span></label>
                <label className="retail-check"><input type="checkbox" aria-label={t("门店自有及账号锁已核验")} checked={draft.storeOwned && checks.ownership} onChange={event => { update("storeOwned", event.target.checked); setChecks(previous => ({ ...previous, ownership: event.target.checked })); }} /><span>{t("门店自有实物，所有权及账号锁已核验")}</span></label>
                <label className="retail-check"><input type="checkbox" aria-label={t("数据处理核验已完成")} checked={checks.data} onChange={event => setChecks(previous => ({ ...previous, data: event.target.checked }))} /><span>{t("数据处理核验已完成")}</span></label>
                <details><summary>{t("检测补充说明（选填）")}</summary><label className="field"><TextareaControl aria-label={t("检测补充说明")} maxLength={600} value={note} onChange={event => setNote(event.target.value)} /></label></details>
              </fieldset> : <label className={"retail-check " + styles.wide}><input type="checkbox" aria-label={t("我确认这是门店自有实物，不是客户送修设备或维修配件。")} checked={draft.storeOwned} onChange={event => update("storeOwned", event.target.checked)} /><span>{t("我确认这是门店自有实物，不是客户送修设备或维修配件。")}</span></label>}
              {error || storageError || feedback?.id === creationId && feedback.error ? <p className={"form-error " + styles.wide} role="alert">{systemText(error || (feedback?.id === creationId && feedback.error ? feedback.message : "") || storageError)}</p> : null}
            </div>
          </section>
          {staff.can("financial.edit") ? <details className={styles.section}><summary>{t("成本（选填）")}</summary><div className={"field-grid " + styles.fields}><RetailMoneyControl label={t("购入 / 回收成本")} value={cost} onChange={setCost} /><RetailMoneyControl label={t("整备费用")} value={refurb} onChange={setRefurb} placeholder={t("未知请留空；已确认无费用可填 0")} /></div></details> : null}
          <details className={styles.section}><summary>{t("来源与存放（选填）")}</summary><div className={"field-grid " + styles.fields}><TextField label={t("存放位置")} value={draft.location} onChange={value => update("location", value)} /><RetailDateControl label={t("入库日期")} value={draft.intakeDate} onChange={value => update("intakeDate", value)} clearable /><label className={"field " + styles.wide}><span>{t("来源说明")}</span><TextareaControl aria-label={t("来源说明")} value={draft.source} maxLength={600} onChange={event => update("source", event.target.value)} /></label></div></details>
        </div>
      </div></div> : null}
      <footer className={styles.footer}><Link className="button button--secondary" href={returnTo} aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}>{t("取消")}</Link><button className="button button--primary" type="submit" disabled={saving || photoBusy || !ready || !!storageError || !classificationSelected || goal === "available" && !canPublish}>{saving ? t("正在保存") : goal === "available" ? t("建档并设为可售") : t("创建独立档案")}</button></footer>
    </fieldset></form>
  </main>;
}
