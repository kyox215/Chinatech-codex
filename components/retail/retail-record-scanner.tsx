"use client";
import Link from "next/link";
import { useState } from "react";
import { ScanLine, X, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { SelectControl } from "@/components/select-control";
import { IdentifierField } from "@/components/identifier-field";
import { identifierScanValue } from "@/lib/identifier-scan";
import { lookupRetailCode, normalizeIdentifier, retailStatuses, type RetailUnit, type RetailCodeType } from "@/lib/retail";
import { retailHistoryCode, retailHistoryStatus, type RetailHistoryRecord } from "@/lib/retail-history";
import { retailRecordHref } from "@/lib/retail-record";
import styles from "./retail-list.module.css";
import surface from "./retail-surface.module.css";
export function RetailRecordScanner({ units, records, onClose, onNavigate }: { units: RetailUnit[]; records: RetailHistoryRecord[]; onClose: () => void; onNavigate: () => void }) {
  const { t, systemText } = useLanguage();
  const [scanCode, setScanCode] = useState(""); const [codeType, setCodeType] = useState<RetailCodeType>("internal");
  const [scanError, setScanError] = useState(""); const [scanResult, setScanResult] = useState<{ raw: string; type: RetailCodeType } | null>(null);
  const candidates = scanResult ? lookupRetailCode(units, scanResult.raw, scanResult.type) : [];
  const managed = new Set(units.flatMap(unit => unit.historyOrigin ? [unit.historyOrigin.recordId] : []));
  const historyCandidates = !scanResult?.raw ? [] : records.filter(record => !managed.has(record.id) && normalizeIdentifier(scanResult.type === "internal" ? retailHistoryCode(record) : record.identifier || "") === normalizeIdentifier(scanResult.raw));
  return <section className={"panel " + styles.scan} aria-label={t("识码查找")}><div className={"detail-section__head " + surface.sectionHead}><div><span><ScanLine size={18} /></span><h3>{t("识码查找")}</h3></div><button className="icon-button" type="button" aria-label={t("收起识码查找")} onClick={() => onClose()}><X size={17} /></button></div><form onSubmit={event => { event.preventDefault(); const raw = scanCode.trim(); const checked = codeType === "imei" ? identifierScanValue(raw,"imei") : null; if (checked?.error) {setScanError(checked.error); setScanResult(null); return;} setScanError(""); setScanResult({raw:checked?.value ?? raw,type:codeType}); }}><label className="field"><span>{t("码类型")}</span><SelectControl aria-label={t("码类型")} value={codeType} onChange={event => { setCodeType(event.target.value as RetailCodeType); setScanResult(null); setScanError(""); }}><option value="internal">{t("内部单机码")}</option><option value="serial">{t("SN 序列号")}</option><option value="imei">IMEI</option><option value="product">{t("包装商品码")}</option></SelectControl></label><IdentifierField required error={systemText(scanError)} label={t("识别内容")} value={scanCode} onChange={value => { setScanCode(value); setScanResult(null); setScanError(""); }} kind={codeType === "imei" ? "imei" : "serial"} placeholder={codeType === "imei" ? t("15 位数字") : t("输入或扫码填入识别内容")} /><button className="button button--primary" type="submit">{t("查找候选")}</button></form>{scanError ? <p className="form-error" role="alert">{systemText(scanError)}</p> : null}{scanResult ? <div className={styles.scanResult} role="status">{!scanResult.raw ? <p>{t("请输入识别内容。")}</p> : candidates.length + historyCandidates.length ? <><p>{scanResult.type === "product" ? t("包装码只对应候选，需核对具体实物。") : t("请选择核对后的单机档案。")}{t("共 ")}{candidates.length + historyCandidates.length} {t(" 台")}</p>{candidates.map(unit => <Link href={"/app/retail/units/" + unit.id} onClick={onNavigate} key={unit.id}>{unit.code} · {unit.brand} {unit.model}<span>{t(retailStatuses[unit.status].label)}<ChevronRight size={16} /></span></Link>)}{historyCandidates.map(record => <Link href={retailRecordHref(record.id)} onClick={onNavigate} key={record.id}>{retailHistoryCode(record)} · {record.brand} {record.model}<span>{t(retailHistoryStatus(record))}<ChevronRight size={16} /></span></Link>)}</> : <><p>{t("未找到匹配。新建前请核对码类型与实物；不会自动创建。")}</p><Link className="button button--secondary" href={"/app/retail/new?identifier=" + encodeURIComponent(scanResult.raw) + "&kind=" + scanResult.type} onClick={onNavigate}>{t("用此码新建档案")}</Link></>}</div> : null}</section>;
}
