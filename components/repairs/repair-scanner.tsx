"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { IdentifierScanner } from "@/components/identifier-scanner";
import { useRepairDirectory } from "./local-intake-store";
import { repairScanMatches } from "@/lib/repair-scan";

/** Repair lookup owns its candidates; camera and photo decoding are shared. */
export function RepairScanner({ iconOnly = false }: { iconOnly?: boolean }) {
  const { t } = useLanguage();
  const repairOrders = useRepairDirectory();
  return <IdentifierScanner title={t("扫码查单")} triggerLabel={t("扫码查单")} iconOnly={iconOnly} prompt={t("扫描工单码或设备序列号")} inputLabel={t("工单号 / SN / IMEI")} manualAction={t("查找工单")} renderResult={(raw, { close, reset }) => {
    const matches = repairScanMatches(raw, repairOrders, typeof window === "undefined" ? "" : window.location.origin);
    return <section className="repair-scanner__results" aria-live="polite"><strong>{matches.length ? t("找到 {v0} 张工单", { v0: matches.length }) : t("未找到匹配工单")}</strong>{matches.map((repair) => <Link key={repair.id} href={`/app/repairs/${repair.id}`} onClick={close}><span><strong>{repair.device.model}</strong><small>{repair.id} · {repair.device.serial}</small></span><span>{t("查看工单 →")}</span></Link>)}{!matches.length ? <button className="button button--secondary" type="button" onClick={reset}>{t("重新识别")}</button> : null}</section>;
  }} />;
}
