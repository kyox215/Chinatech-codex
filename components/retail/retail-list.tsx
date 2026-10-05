"use client";

import { retailDisplaySpec } from "@/lib/i18n/retail-display";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { useStaff } from "@/components/staff/use-staff";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SelectControl } from "@/components/select-control";
import { IdentifierField } from "@/components/identifier-field";
import { ColorSwatch } from "@/components/color-picker";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Boxes, ChevronRight, ClipboardCheck, Clock3, PackageCheck, Plus, ScanLine, Search, SlidersHorizontal, X } from "lucide-react";
import { lookupRetailCode, retailCategories, retailMoney, retailSpec, retailStatuses, type RetailCategory, type RetailCodeType } from "@/lib/retail";
import { identifierScanValue } from "@/lib/identifier-scan";
import { useRetail } from "./retail-provider";
import { UnitIcon } from "./unit-icon";
import { useRetailHistory } from "./retail-history-store";
import { RetailHistoryList } from "./retail-history-list";
import surface from "./retail-surface.module.css";
import styles from "./retail-list.module.css";

const statusOptions = { inhouse: "在库实物", all: "全部记录", available: "可售", reserved: "已预留", processing: "待检测 / 暂停", inspecting: "待检测", hold: "暂停销售", sold: "已售出" };
const conditionOptions = [{ value: "all", label: "全部" }, { value: "新机", label: "新机" }, { value: "翻新机", label: "翻新机" }] as const;
type StatusFilter = keyof typeof statusOptions;
const matchStatus = (status: string, filter: string) => filter === "all" || (filter === "inhouse" ? status !== "sold" : filter === "processing" ? status === "inspecting" || status === "hold" : status === filter);

export function RetailList() {
  const { t } = useLanguage();
  const staff = useStaff();
  const { units, ready, error } = useRetail();
  const history = useRetailHistory();
  const params = useSearchParams();
  const source = params.get("source");
  if (!ready || !history.ready) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={t("整机商品")} /></header><div className="panel module-empty" role="status">{t("正在读取整机记录…")}</div></main>;
  if (!staff.can("retail.view")) return <main className={`module-page ${surface.page}`}><header className="module-heading"><PageTitle title={t("整机商品")} /></header><div className="panel module-empty"><strong>{t("当前账号无权查看整机记录")}</strong></div></main>;
  return source === "units"
    ? <RetailUnitList sourceTabs={<nav className="module-heading" aria-label={t("整机页面")}><Link className="button button--secondary" href="/app/retail">{t("返回在售商品")}</Link></nav>} />
    : <RetailHistoryList records={history.records} ready={history.ready} error={[history.error, error].filter(Boolean).join(" ")} units={units} />;
}

function RetailUnitList({ sourceTabs }: { sourceTabs: ReactNode }) {
  const { t, locale } = useLanguage();
  const staff=useStaff();
  const { units, dispatch, returnTo, returnScroll } = useRetail();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const categoryValue = params.get("category") ?? "all";
  const category = Object.hasOwn(retailCategories, categoryValue) ? categoryValue as RetailCategory : "all";
  const conditionValue = params.get("condition");
  const condition = conditionValue === "新机" || conditionValue === "翻新机" ? conditionValue : "all";
  const statusValue = params.get("status") ?? "inhouse";
  const status = Object.hasOwn(statusOptions, statusValue) ? statusValue as StatusFilter : "inhouse";
  const sort = ["newest", "oldest", "price-asc", "price-desc"].includes(params.get("sort") ?? "") ? params.get("sort")! : "newest";
  const listUrl = `/app/retail${params.size ? `?${params.toString()}` : ""}`;
  const [scanOpen, setScanOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [codeType, setCodeType] = useState<RetailCodeType>("internal");
  const [scanError,setScanError] = useState("");
  const [scanResult, setScanResult] = useState<{ raw: string; type: RetailCodeType } | null>(null);
  useEffect(() => { if (listUrl === returnTo) window.scrollTo(0, returnScroll); }, [listUrl, returnTo, returnScroll]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || ((key === "category" || key === "condition") && value === "all") || (key === "status" && value === "inhouse") || (key === "sort" && value === "newest")) next.delete(key); else next.set(key, value);
    window.history.replaceState(null, "", `/app/retail${next.size ? `?${next.toString()}` : ""}`);
  }
  const remember = () => dispatch({ type: "remember", url: listUrl, scroll: window.scrollY });
  const normalized = query.trim().toLowerCase();
  const searched = units.filter((unit) => (category === "all" || unit.category === category) && [unit.code, unit.serial, unit.imei1, unit.imei2, unit.productCode, unit.brand, unit.model, unit.color, unit.location, retailSpec(unit)].join(" ").toLowerCase().includes(normalized));
  const filtered = searched.filter((unit) => matchStatus(unit.status, status) && (condition === "all" || unit.condition === condition)).sort((left, right) => {
    if (sort.startsWith("price")) {
      if (left.priceCents === null) return right.priceCents === null ? 0 : 1;
      if (right.priceCents === null) return -1;
      return (left.priceCents - right.priceCents) * (sort === "price-asc" ? 1 : -1);
    }
    return (left.intakeDate || "0000").localeCompare(right.intakeDate || "0000") * (sort === "oldest" ? 1 : -1);
  });
  const candidates = scanResult ? lookupRetailCode(units, scanResult.raw, scanResult.type) : [];
  const stats = [
    { value: "inhouse", label: "在库实物", icon: Boxes, tone: "neutral" },
    { value: "available", label: "可售", icon: PackageCheck, tone: "success" },
    { value: "reserved", label: "已预留", icon: Clock3, tone: "primary" },
    { value: "processing", label: "待检测 / 暂停", icon: ClipboardCheck, tone: "warning" },
  ];
  const filterCount = Number(category !== "all") + Number(status !== "inhouse") + Number(sort !== "newest");
  const hasFilters = Boolean(query) || filterCount > 0 || condition !== "all";
  const clearFilters = () => window.history.replaceState(null, "", "/app/retail?source=units");

  return <main className={"module-page " + surface.page}>
    <header className="module-heading"><PageTitle title={t("整机商品")} /><div className="module-heading__actions"><button className="button button--secondary button--compact page-toolbar-action" type="button" aria-label={t("识码查找")} title={t("识码查找")} aria-expanded={scanOpen} onClick={() => setScanOpen(!scanOpen)}><ScanLine size={17} /><span>{t("识码查找")}</span></button>{staff.can("retail.edit")?<Link className="button button--primary button--compact" href="/app/retail/new" onClick={remember}><Plus size={17} />{t("新建单机")}</Link>:null}</div></header>
    {sourceTabs}
    <section className={styles.stats} aria-label={t("整机状态筛选")}>{stats.map(({ value, label, icon: Icon, tone }) => <button className={styles.stat + " " + (styles[tone] || "") + (status === value ? " " + styles.active : "")} key={value} type="button" aria-pressed={status === value} onClick={() => update("status", value)}><span className={styles.statIcon}><Icon size={20} aria-hidden="true" /></span><span>{t(label)}</span><strong>{searched.filter(unit => matchStatus(unit.status, value) && (condition === "all" || unit.condition === condition)).length}</strong></button>)}</section>
    {scanOpen ? <section className={"panel " + styles.scan} aria-label={t("识码查找")}><div className={"detail-section__head " + surface.sectionHead}><div><span><ScanLine size={18} /></span><h3>{t("识码查找")}</h3></div><button className="icon-button" type="button" aria-label={t("收起识码查找")} onClick={() => setScanOpen(false)}><X size={17} /></button></div><form onSubmit={event => { event.preventDefault(); const raw = scanCode.trim(); const checked = codeType === "imei" ? identifierScanValue(raw,"imei") : null; if (checked?.error) {setScanError(checked.error); setScanResult(null); return;} setScanError(""); setScanResult({raw:checked?.value ?? raw,type:codeType}); }}><label className="field"><span>{t("码类型")}</span><SelectControl aria-label={t("码类型")} value={codeType} onChange={event => { setCodeType(event.target.value as RetailCodeType); setScanResult(null); setScanError(""); }}><option value="internal">{t("内部单机码")}</option><option value="serial">{t("SN 序列号")}</option><option value="imei">IMEI</option><option value="product">{t("包装商品码")}</option></SelectControl></label><IdentifierField required error={t(scanError)} label={t("识别内容")} value={scanCode} onChange={value => { setScanCode(value); setScanResult(null); setScanError(""); }} kind={codeType === "imei" ? "imei" : "serial"} placeholder={codeType === "imei" ? t("15 位数字") : t("输入或扫码填入识别内容")} /><button className="button button--primary" type="submit">{t("查找候选")}</button></form>{scanError ? <p className="form-error" role="alert">{t(scanError)}</p> : null}{scanResult ? <div className={styles.scanResult} role="status">{!scanResult.raw ? <p>{t("请输入识别内容。")}</p> : candidates.length ? <><p>{scanResult.type === "product" ? t("包装码只对应候选，需核对具体实物。") : t("请选择核对后的单机档案。")}{t("共 ")}{candidates.length} {t(" 台")}</p>{candidates.map(unit => <Link href={"/app/retail/units/" + unit.id} onClick={remember} key={unit.id}>{unit.code} · {unit.brand} {unit.model}<span>{t(retailStatuses[unit.status].label)}<ChevronRight size={16} /></span></Link>)}</> : <><p>{t("未找到匹配。新建前请核对码类型与实物；不会自动创建。")}</p><Link className="button button--secondary" href={"/app/retail/new?identifier=" + encodeURIComponent(scanResult.raw) + "&kind=" + scanResult.type} onClick={remember}>{t("用此码新建档案")}</Link></>}</div> : null}</section> : null}
    <section className={"panel " + styles.list}>
      <div className={styles.toolbar}>
        <div className={styles.classification} role="group" aria-label={t("商品分类筛选")}>{conditionOptions.map(({ value, label }) => <button type="button" key={value} className={condition === value ? styles.classificationActive : ""} aria-pressed={condition === value} onClick={() => update("condition", value)}><span>{t(label)}</span><small>{searched.filter(unit => matchStatus(unit.status, status) && (value === "all" || unit.condition === value)).length}</small></button>)}</div>
        <div className={styles.searchRow}><label className="module-search"><Search size={18} /><InputControl onClear={() => update("q", "")} clearLabel={t("清空搜索整机")} type="search" aria-label={t("搜索整机")} value={query} onChange={event => update("q", event.target.value)} placeholder={t("型号、单机码、SN、规格或位置")} /></label><button className={"button button--secondary " + styles.filterToggle} type="button" aria-label={t("筛选与排序")} aria-controls="retail-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18} />{filterCount || null}</button></div>
        <div id="retail-filters" className={styles.filters + (filtersOpen ? " " + styles.filtersOpen : "")}>
          <label className="module-select"><SelectControl aria-label={t("商品类型筛选")} value={category} onChange={event => update("category", event.target.value)}><option value="all">{t("全部类型")}</option>{Object.entries(retailCategories).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</SelectControl></label>
          <label className="module-select"><SelectControl aria-label={t("商品状态筛选")} value={status} onChange={event => update("status", event.target.value)}>{Object.entries(statusOptions).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</SelectControl></label>
          <label className="module-select"><SelectControl aria-label={t("整机排序")} value={sort} onChange={event => update("sort", event.target.value)}><option value="newest">{t("最近入库")}</option><option value="oldest">{t("最早入库")}</option><option value="price-asc">{t("售价升序")}</option><option value="price-desc">{t("售价降序")}</option></SelectControl></label>
        </div>
        <span className={styles.count}>{filtered.length} {t(" 台")}</span>
      </div>
      {hasFilters ? <div className={styles.applied} aria-label={t("当前筛选")}><span>{[query ? "搜索：" + query : "", condition !== "all" ? condition : "", category !== "all" ? retailCategories[category as RetailCategory] : "", statusOptions[status], sort === "newest" ? "" : sort === "oldest" ? "最早入库" : sort === "price-asc" ? "售价升序" : "售价降序"].filter(Boolean).join(" · ")}</span><button type="button" aria-label={t("清除全部筛选")} onClick={clearFilters}><X size={15} />{t("清除")}</button></div> : null}
      <div className={"module-table-scroll " + styles.table} role="region" aria-label={t("整机表格")} tabIndex={0}>
        <div className={styles.tableHead} aria-hidden="true"><span>{t("商品 / 规格")}</span><span>{t("识别码")}</span><span>{t("分类 / 成色 / 位置")}</span><span>{t("标价")}</span><span>{t("状态")}</span><span /></div>
        {filtered.map(unit => <Link className={styles.row} key={unit.id} href={"/app/retail/units/" + unit.id} onClick={remember}>
          <div className={styles.product}><span className={surface.glyph}><UnitIcon category={unit.category} /></span><div><strong title={unit.brand + " " + unit.model}>{unit.brand} {unit.model}</strong><small className={styles.spec} title={(unit.color ? t(unit.color) : t("颜色待确认")) + " · " + retailDisplaySpec(unit, locale)}><ColorSwatch value={unit.color} /><span>{unit.color ? t(unit.color) : t("颜色待确认")} · {retailDisplaySpec(unit, locale)}</span></small></div></div>
          <div className={styles.identity}><strong title={unit.code}>{unit.code}</strong><small title={unit.serial}>{unit.serial ? "SN " + unit.serial : t("未记录 SN")}</small></div>
          <div className={styles.condition}><strong>{unit.condition} · {unit.grade}</strong><small title={unit.location}>{unit.location || t("位置待确认")}</small></div>
          <strong className={styles.price}>{retailMoney(unit.priceCents)}</strong><span className={"status-pill status-pill--" + retailStatuses[unit.status].tone + " " + styles.status}>{t(retailStatuses[unit.status].label)}</span><ChevronRight className={styles.arrow} size={17} />
        </Link>)}
      </div>
      {!filtered.length ? <div className="module-empty"><Boxes size={28} /><strong>{t("没有符合条件的单机")}</strong><p>{t("试试其他型号、识别码或状态。")}</p><button className="button button--secondary" type="button" onClick={clearFilters}>{t("清除筛选")}</button></div> : null}
    </section>
  </main>;
}
