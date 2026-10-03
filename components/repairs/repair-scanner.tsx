"use client";

import Link from "next/link";
import { IdentifierScanner } from "@/components/identifier-scanner";
import { useRepairDirectory } from "./local-intake-store";
import { repairScanMatches } from "@/lib/repair-scan";

/** Repair lookup owns its candidates; camera and photo decoding are shared. */
export function RepairScanner({ iconOnly = false }: { iconOnly?: boolean }) {
  const repairOrders = useRepairDirectory();
  return <IdentifierScanner title="扫码查单" triggerLabel="扫码查单" iconOnly={iconOnly} prompt="扫描工单码或设备序列号" inputLabel="工单号 / SN / IMEI" manualAction="查找工单" renderResult={(raw, { close, reset }) => {
    const matches = repairScanMatches(raw, repairOrders, typeof window === "undefined" ? "" : window.location.origin);
    return <section className="repair-scanner__results" aria-live="polite"><strong>{matches.length ? `找到 ${matches.length} 张工单` : "未找到匹配工单"}</strong>{matches.map((repair) => <Link key={repair.id} href={`/app/repairs/${repair.id}`} onClick={close}><span><strong>{repair.device.model}</strong><small>{repair.id} · {repair.device.serial}</small></span><span>查看工单 →</span></Link>)}{!matches.length ? <button className="button button--secondary" type="button" onClick={reset}>重新识别</button> : null}</section>;
  }} />;
}
