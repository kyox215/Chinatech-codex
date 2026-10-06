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
import { useRef, useState } from "react";
import { ArrowLeft, Boxes, ChevronRight, Copy, Cpu, Euro, ImagePlus, MapPin, Package, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { changeRetailDraftCategory, copyRetailModel, emptyRetailUnit, hasBattery, isComputer, normalizeImei, parseRetailMoney, retailCategories, validateRetailUnit, type RetailCategory, type RetailUnit } from "@/lib/retail";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { useRetail } from "./retail-provider";
import { RetailWarrantyControl } from "./retail-warranty-control";
import { RetailCatalogControl, RetailDisksControl, RetailRamControl, RetailStorageControl } from "./retail-spec-controls";
import { RetailDateControl, RetailMoneyControl, RetailNumberControl } from "./retail-input-controls";
import styles from "./retail-form.module.css";
import surface from "./retail-surface.module.css";

function TextField({ label, value, onChange, placeholder, maxLength = 120 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  const { t } = useLanguage();
  return <label className="field"><span>{t(label)}</span><InputControl onClear={() => onChange("")} clearLabel={t("清空{v0}", { v0: label })} aria-label={t(label)} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

type RetailFormProps = { copyId?: string; identifier?: string; kind?: string };
export function RetailForm(props: RetailFormProps) {
  const { t } = useLanguage();
  const staff = useStaff();
  const { ready, error, returnTo } = useRetail();
  const store = useStoreSettings();
  if (!staff.ready || !ready || !store.ready) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={props.copyId ? t("同型号新建商品") : t("新建商品")} backHref={returnTo} backLabel={t("返回商品列表")} /></header><section className="panel module-empty" role="status">{t("正在读取单机资料…")}</section></main>;
  if (!staff.can("retail.edit")) return <AccessPanel />;
  if (error || store.error) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={t("新建商品")} backHref={returnTo} backLabel={t("返回商品列表")} /></header><section className="panel module-empty" role="alert">{t(error) || store.error}</section></main>;
  return <RetailFormContent {...props} />;
}

function RetailFormContent({ copyId, identifier, kind }: RetailFormProps) {
  const { t } = useLanguage();
  const staff=useStaff();
  const { units, returnTo, dispatch, ready, error: storageError } = useRetail();
  const router = useRouter();
  const {settings} = useStoreSettings();
  const sourceUnit = units.find((unit) => unit.id === copyId);
  const [draft, setDraft] = useState<RetailUnit>(() => {
    const initial = sourceUnit ? copyRetailModel(sourceUnit) : emptyRetailUnit();
    initial.warrantyMonths = settings.retailWarrantyMonths;
    const raw = identifier?.trim().slice(0, 150) ?? "";
    if (kind === "serial") initial.serial = raw;
    if (kind === "imei") initial.imei1 = raw;
    if (kind === "product") initial.productCode = raw;
    return initial;
  });
  const [step, setStep] = useState(0);
  const [classificationSelected, setClassificationSelected] = useState(false);
  const [error, setError] = useState("");
  const [cost, setCost] = useState("");
  const [refurb, setRefurb] = useState("");
  const [price, setPrice] = useState("");
  const stepsRef = useRef<HTMLElement>(null);
  const [creationId,setCreationId] = useState(()=>crypto.randomUUID());
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const deviceDraft=useDeviceDraft(`retail-new:${copyId??""}:${identifier??""}`,{draft,step,classificationSelected,cost,refurb,price,creationId},value=>{
    if(!value.draft?.category || !value.creationId)throw new Error("草稿格式无效。");
    setDraft(value.draft);setStep(value.step);setClassificationSelected(value.classificationSelected);setCost(value.cost);setRefurb(value.refurb);setPrice(value.price);setCreationId(value.creationId);
  });
  function goToStep(next: number) {
    if (submitting.current) return;
    setStep(next);
    setError("");
    stepsRef.current?.scrollIntoView({ block: "start" });
    stepsRef.current?.focus({ preventScroll: true });
  }
  function update<K extends keyof RetailUnit>(key: K, value: RetailUnit[K]) { setDraft((previous) => ({ ...previous, [key]: value })); }
  function changeCategory(category: RetailCategory) {
    setDraft(previous => changeRetailDraftCategory(previous, category));
  }

  function nextStep() {
    try { if (!classificationSelected) throw new Error("请先选择新机或翻新机。"); validateRetailUnit({ ...draft, storeOwned: true }, units); goToStep(step + 1); } catch (error) { setError(error instanceof Error ? error.message : "请核对资料。"); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) { nextStep(); return; }
    if (submitting.current) return;
    try {
      if (!classificationSelected) throw new Error("请先选择新机或翻新机。");
      const id = creationId;
      const unit = { ...draft, id, code: "", brand: draft.brand.trim(), model: draft.model.trim(), serial: draft.serial.trim(), imei1: normalizeImei(draft.imei1), imei2: normalizeImei(draft.imei2), productCode: draft.productCode.trim(), costCents: staff.can("financial.edit") ? parseRetailMoney(cost) : null, refurbCents: staff.can("financial.edit") ? parseRetailMoney(refurb) : null, priceCents: staff.can("retail.price") ? parseRetailMoney(price) : null };
      validateRetailUnit(unit, units);
      submitting.current = true;
      setSaving(true);
      const saved=await dispatch({ type: "create", unit, event: { id: crypto.randomUUID(), title: "独立单机档案已建立", detail: "确认门店自有实物；新档案保持待检测，不自动可售。", time: intakeRecordTime() } });
      if(!saved) throw new Error("单机未保存，请核对权限并重试。");
      await deviceDraft.clear();router.push(`/app/retail/units/${id}`);
    } catch (error) { submitting.current = false; setSaving(false); setError(error instanceof Error ? error.message : "请核对单机资料。"); }
  }

  if(!staff.can("retail.edit")) return <AccessPanel/>;
  return <main className={`module-page retail-create ${surface.page} ${styles.create}`}>
    <header className="module-heading"><PageTitle title={sourceUnit ? t("同型号新建商品") : t("新建商品")} backHref={saving ? undefined : returnTo} backLabel={t("返回商品列表")} /></header>
    {sourceUnit ? <div className={`inline-notice ${styles.notice}`}><Copy size={17} aria-hidden="true" /><span>{t("从 ")}{sourceUnit.code} {t(" 复制型号与候选规格；身份、照片、检测、电池、手柄数量、来源与金额均已清空，请逐项核对实物。")}</span></div> : copyId ? <div className={`inline-notice ${styles.notice}`} role="status">{t("复制来源不存在，当前为空白新档案。")}</div> : identifier ? <div className={`inline-notice ${styles.notice}`} role="status">{t("识别文本仅作为待核对字段，不证明机器身份或规格。")}{kind === "internal" ? t("内部码由本系统另行分配，不沿用未知码。") : ""}</div> : null}
    <form className={`panel ${styles.form}`} aria-busy={saving} onSubmit={submit}><fieldset className="form-fields" disabled={saving}>
      <DeviceDraftNotice draft={deviceDraft}/><nav ref={stepsRef} tabIndex={-1} className={styles.steps} aria-label={t("单机录入步骤")}>
        {["基础与规格", "成色与随件", "金额与来源"].map((label, index) => <span className={`${styles.step} ${step === index ? styles.activeStep : ""}`} key={label} aria-current={step === index ? "step" : undefined}><i>{index + 1}</i><span>{t(label)}</span></span>)}
      </nav>
      {error || storageError ? <div className="procurement-feedback procurement-feedback--error" role="alert">{t(error || storageError)}</div> : null}
      <div className={styles.body}>
        <div className={styles.layout}>
          {step === 0 ? <>
            <section className={`${styles.section} ${styles.wide} ${styles.classification}`} aria-label={t("选择商品分类")}><SingleChoice label={t("商品分类 *")} value={classificationSelected ? draft.condition : ""} options={[{value:"新机",label:"新机",icon:Package},{value:"翻新机",label:"翻新机",icon:Sparkles}]} onChange={value => { update("condition", value as RetailUnit["condition"]); setClassificationSelected(true); setError(""); }} /></section>
            {classificationSelected ? <>
            <section className={styles.section} aria-labelledby="retail-identity-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><Package size={17} aria-hidden="true" /></span><h3 id="retail-identity-heading">{t("实物身份")}</h3></div></header>
              <div className={`field-grid ${styles.fields}`}>
                <label className="field"><span>{t("商品类型")}</span><SelectControl aria-label={t("商品类型")} value={draft.category} onChange={(event) => changeCategory(event.target.value as RetailCategory)}>{Object.entries(retailCategories).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</SelectControl></label>
                <RetailCatalogControl field="brand" category={draft.category} units={units} label={t("品牌")} value={draft.brand} onChange={value => setDraft(previous => ({...previous, brand:value, ...(previous.brand === value ? {} : {model:""})}))} />
                <RetailCatalogControl field="model" category={draft.category} brand={draft.brand} units={units} label={t("型号 / 商品名称")} required value={draft.model} onChange={value => update("model",value)} />
                <ColorPicker key={`color-${draft.category}`} value={draft.color} onChange={(value) => update("color", value)} />
              </div>
            </section>
            <section className={styles.section} aria-labelledby="retail-identifiers-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><ScanLine size={17} aria-hidden="true" /></span><h3 id="retail-identifiers-heading">{t("识别码")}</h3></div></header>
              <div className={`field-grid ${styles.fields}`}>
                <IdentifierField label={t("SN 序列号")} value={draft.serial} onChange={(value) => update("serial", value)} kind="serial" />
                <IdentifierField label={t("包装商品码")} value={draft.productCode} onChange={(value) => update("productCode", value)} kind="serial" placeholder={t("可与同型号其他单机共用")} maxLength={150} />
                {draft.category === "phone" || draft.category === "tablet" ? <>
                  <IdentifierField label="IMEI 1" value={draft.imei1} onChange={(value) => update("imei1", value)} kind="imei" placeholder={t("15 位数字；Wi-Fi 平板可留空")} />
                  <IdentifierField label="IMEI 2" value={draft.imei2} onChange={(value) => update("imei2", value)} kind="imei" placeholder={t("与 IMEI 1 共用查重范围")} />
                </> : null}
              </div>
            </section>
            {draft.category !== "other" ? <section className={`${styles.section} ${styles.wide}`} aria-labelledby="retail-specs-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><Cpu size={17} aria-hidden="true" /></span><h3 id="retail-specs-heading">{t("实测规格")}</h3></div></header>
              <div className={`field-grid ${styles.fields}`}>
                {["phone", "tablet", "laptop", "desktop"].includes(draft.category) ? <RetailRamControl key={`ram-${draft.category}`} value={draft.ramGb} onChange={value => update("ramGb", value)} /> : null}
                {["phone", "tablet", "console"].includes(draft.category) ? <RetailStorageControl key={draft.category} category={draft.category} value={draft.bodyStorage} onChange={value => update("bodyStorage", value)} /> : null}
                {isComputer(draft.category) ? <>
                  <RetailCatalogControl field="cpu" category={draft.category} units={units} label="CPU" value={draft.cpu} onChange={value => update("cpu",value)} />
                  <RetailCatalogControl field="gpu" category={draft.category} units={units} label="GPU" value={draft.gpu} onChange={value => update("gpu",value)} />
                  {draft.category === "laptop" ? <RetailCatalogControl field="keyboard" category={draft.category} units={units} label={t("键盘布局")} value={draft.keyboard} onChange={value => update("keyboard",value)} /> : null}
                  <div className={styles.wide}><RetailDisksControl key={`disks-${draft.category}`} category={draft.category} value={draft.disks} onChange={value => update("disks",value)} /></div>
                </> : null}
                {["phone", "tablet", "console"].includes(draft.category) ? <RetailCatalogControl field="edition" category={draft.category} units={units} label={t("版本 / 网络")} value={draft.edition} onChange={value => update("edition",value)} /> : null}
              </div>
            </section> : null}
            </> : null}
          </> : step === 1 ? <>
            <section className={styles.section} aria-labelledby="retail-condition-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><Sparkles size={17} aria-hidden="true" /></span><h3 id="retail-condition-heading">{t("成色与实物状况")}</h3></div></header>
              <div className={`field-grid ${styles.fields}`}>
                <SingleChoice className={styles.wide} label={t("外观等级")} value={draft.grade} options={["待评估","S","A","B","C"].map(value => ({value,label:value}))} onChange={value => update("grade",value as RetailUnit["grade"])} />
                {hasBattery(draft.category) ? <div className={styles.wide}><RetailNumberControl key={`battery-${draft.category}`} battery label={draft.category === "console" ? t("电池健康（适用时）") : t("电池健康")} unit="%" value={draft.batteryPercent} onChange={value => update("batteryPercent", value)} /></div> : null}
                <label className={`field ${styles.wide}`}><span>{t("已知问题与外观说明")}</span><TextareaControl aria-label={t("已知问题与外观说明")} value={draft.knownIssues} maxLength={600} onChange={(event) => update("knownIssues", event.target.value)} placeholder={t("记录本台实物情况；不要录入账号密码")} /></label>
              </div>
            </section>
            <section className={styles.section} aria-labelledby="retail-accessories-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><ImagePlus size={17} aria-hidden="true" /></span><h3 id="retail-accessories-heading">{t("随件与照片")}</h3></div></header>
              <div className={`field-grid ${styles.fields} ${styles.singleColumn}`}>
                {draft.category === "console" ? <RetailNumberControl label={t("实际随附手柄数量")} value={draft.controllers} onChange={(value) => update("controllers", value)} /> : null}
                <label className="field"><span>{t("实际随附物品")}</span><TextareaControl aria-label={t("实际随附物品")} value={draft.accessories} onChange={event => update("accessories",event.target.value)} maxLength={600} placeholder={t("充电器、盒子、线材等")} /></label>
                <div className={styles.photoEmpty}><ImagePlus size={22} aria-hidden="true" /><div><strong>{t("本台实物照片")}</strong><p>{t("建档后在单机档案上传本台照片，不沿用其他单机照片。")}</p></div></div>
              </div>
            </section>
            <div className={`form-guidance ${styles.guidance} ${styles.wide}`}><Boxes size={18} aria-hidden="true" /><p>{t("检测在建档后单独记录。新建不会自动勾选功能、所有权与账号或数据处理检查。")}</p></div>
          </> : <>
            <section className={styles.section} aria-labelledby="retail-money-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><Euro size={17} aria-hidden="true" /></span><h3 id="retail-money-heading">{t("金额")}</h3></div></header>
              <div className={`field-grid ${styles.fields} ${styles.singleColumn}`}>
                {staff.can("financial.edit")?<RetailMoneyControl label={t("购入 / 回收成本")} value={cost} onChange={setCost} placeholder={t("未知请留空")} />:null}
                {staff.can("financial.edit")?<RetailMoneyControl label={t("整备费用")} value={refurb} onChange={setRefurb} placeholder={t("未知请留空；已确认无费用可填 0")} />:null}
                {staff.can("retail.price")?<RetailMoneyControl label={t("标价")} value={price} onChange={setPrice} placeholder={t("独立定价；未知请留空")} />:null}
                <RetailWarrantyControl value={draft.warrantyMonths} onChange={(value) => update("warrantyMonths", value)} />
              </div>
            </section>
            <section className={styles.section} aria-labelledby="retail-source-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><MapPin size={17} aria-hidden="true" /></span><h3 id="retail-source-heading">{t("来源与存放")}</h3></div></header>
              <div className={`field-grid ${styles.fields} ${styles.singleColumn}`}>
                <TextField placeholder={t("例如：展示柜 A-02")} label={t("存放位置")} value={draft.location} onChange={(value) => update("location", value)} />
                <label className="field"><span>{t("来源说明")}</span><TextareaControl aria-label={t("来源说明")} value={draft.source} maxLength={600} onChange={event => update("source",event.target.value)} placeholder={t("记录本台来源，不收集个人凭据")} /></label>
                <RetailDateControl label={t("入库日期")} value={draft.intakeDate} onChange={value => update("intakeDate",value)} clearable />
              </div>
            </section>
            <section className={`${styles.section} ${styles.wide}`} aria-labelledby="retail-ownership-heading">
              <header className={`detail-section__head ${surface.sectionHead}`}><div><span><ShieldCheck size={17} aria-hidden="true" /></span><h3 id="retail-ownership-heading">{t("所有权核对")}</h3></div></header>
              <div className={styles.confirmation}>
                <label className={`retail-check ${styles.ownershipCheck}`}><input type="checkbox" checked={draft.storeOwned} onChange={(event) => update("storeOwned", event.target.checked)} /><span>{t("我确认这是门店自有实物，不是客户送修设备或维修配件。")}</span></label>
                <div className={`form-guidance ${styles.guidance}`}><Boxes size={18} aria-hidden="true" /><p>{t("系统会分配一个新的独立单机编号，状态为待检测。保存后可在单机详情继续检测。")}</p></div>
              </div>
            </section>
          </>}
        </div>
      </div>
      <footer className={styles.footer}>
        {step > 0 ? <button className="button button--secondary" type="button" onClick={() => goToStep(step - 1)}><ArrowLeft size={17} aria-hidden="true" />{t("上一步")}</button> : <Link className="button button--secondary" href={returnTo}>{t("取消")}</Link>}
        <button className="button button--primary" type="submit" disabled={saving || !ready || Boolean(storageError) || (step === 0 && !classificationSelected)}>{saving ? t("正在保存") : step === 2 ? t("创建独立档案") : t("下一步")}<ChevronRight size={17} aria-hidden="true" /></button>
      </footer>
    </fieldset></form>
  </main>;
}
