"use client";
import { useState } from "react";
import { useBackendLookup } from "@/components/backend-lookup";
import { PageControls } from "@/components/backend-query";
import type { RepairDirectoryEntry } from "@/lib/repair-intake-record";

import Link from "next/link";
import { IdentifierScanner } from "@/components/identifier-scanner";
import { useRepairDirectory } from "./local-intake-store";
import { repairScanMatches } from "@/lib/repair-scan";

/** Repair lookup owns its candidates; camera and photo decoding are shared. */
export function RepairScanner() {
  const repairOrders = useRepairDirectory();
  return <IdentifierScanner title="扫码查单" triggerLabel="扫码查单" prompt="扫描工单码或设备序列号" inputLabel="工单号 / SN / IMEI" manualAction="查找工单" renderResult={(raw, { close, reset }) => {
    return <RepairScanResults raw={raw} orders={repairOrders} close={close} reset={reset}/>;
  }} />;
}
function RepairScanResults({raw,orders,close,reset}:{raw:string;orders:RepairDirectoryEntry[];close:()=>void;reset:()=>void}) {
  const [page,setPage]=useState(1);const lookup=useBackendLookup<RepairDirectoryEntry>("repair",raw,"internal",page);
  const matches=lookup.backend?lookup.rows:repairScanMatches(raw,orders,typeof window==="undefined"?"":window.location.origin);
    return <section className="repair-scanner__results" aria-live="polite">{lookup.loading?<p role="status">正在查找全部工单…</p>:lookup.error?<p className="form-error" role="alert">{lookup.error}</p>:null}<strong>{matches.length ? `找到 ${lookup.backend?lookup.total:matches.length} 张工单` : "未找到匹配工单"}</strong>{matches.map((repair) => <Link key={repair.id} href={`/app/repairs/${repair.id}`} onClick={close}><span><strong>{repair.device.model}</strong><small>{repair.id} · {repair.device.serial}</small></span><span>查看工单 →</span></Link>)}{!matches.length ? <button className="button button--secondary" type="button" onClick={reset}>重新识别</button> : null}<PageControls page={lookup.page} pageCount={lookup.pageCount} onPage={setPage}/></section>;
}
