"use client";

import { useLanguage } from "@/components/language-provider";
import { NavigationLink as Link } from "@/components/navigation-link";
import { IdentifierScanner } from "@/components/identifier-scanner";
import { useRepairDirectory } from "./local-intake-store";
import { repairScanMatches } from "@/lib/repair-scan";
import {useRef} from "react";
import {useBackendState} from "../backend-snapshot";
import {useIdentifierCandidates} from "../use-identifier-candidates";
import {WindowedListRows} from "../windowed-list-rows";
import {ListPagination} from "../list-pagination";
import {ReadFailure,ReadPending} from "../page-recovery";
import {can} from "@/lib/staff";
import type {RepairScanCandidate} from "@/lib/backend/repair-scan-contract";

function RepairScanResults({raw,close,reset}:{raw:string;close:()=>void;reset:()=>void}){
 const backend=useBackendState(),orders=useRepairDirectory(),member=backend.snapshot?.staff.members.find(row=>row.id===backend.snapshot?.staff.currentId);
 const remote=Boolean(backend.snapshot?.repairListEnabled),scope=remote&&backend.active&&can(member,"repairs.view")?backend.snapshot?.read?.scope:undefined;
 const result=useIdentifierCandidates<RepairScanCandidate>(scope,"/api/backend/v2/repair-scan",raw,backend.snapshot?.revision??0),dialog=useRef<HTMLElement|null>(null),{t}=useLanguage();
 const legacy=repairScanMatches(raw,orders,typeof window==="undefined"?"":window.location.origin).map(row=>({id:row.id,model:row.device.model,serial:row.device.serial}));
 const items=remote?result.page?.items??[]:legacy,total=remote?result.page?.total:legacy.length;
 if(remote&&!scope)return null;
 return <section ref={node=>{dialog.current=node?.closest("dialog")??null;}} className="repair-scanner__results" aria-live="polite" aria-busy={result.pending}>
  {result.error?<ReadFailure message={result.error} pending={result.pending} onRetry={result.retry}/>:null}
  {remote&&!result.page?result.pending?<ReadPending/>:null:<>
   <strong>{total?t("找到 {v0} 张工单",{v0:total}):t("未找到匹配工单")}</strong>
   <WindowedListRows items={items} startIndex={result.page?.startIndex??0} total={total??0} extent={remote?result.extent:items.length} version={result.page?.stateToken??raw} rowKey={row=>row.id} scrollRoot={dialog} anchorSelector="a" pending={result.pending} onSeek={remote?result.seek:undefined} render={(repair,props)=><div {...props} className="repair-scanner__candidate"><Link href={`/app/repairs/${repair.id}`} onClick={close}><span><strong>{repair.model}</strong><small>{repair.id} · {repair.serial}</small></span><span>{t("查看工单 →")}</span></Link></div>}/>
   {remote&&result.page?<ListPagination start={result.page.startIndex} shown={result.page.startIndex+items.length} total={total} hasMore={Boolean(result.page.nextCursor)} loading={result.pending} error={Boolean(result.error)} onLoadMore={result.loadMore} resetKey={result.key}/>:null}
   {!total?<button className="button button--secondary" type="button" onClick={reset}>{t("重新识别")}</button>:null}
  </>}
 </section>;
}

/** Repair lookup owns its candidates; camera and photo decoding are shared. */
export function RepairScanner({ iconOnly = false }: { iconOnly?: boolean }) {
  const { t } = useLanguage();
  return <IdentifierScanner title={t("扫码查单")} triggerLabel={t("扫码查单")} iconOnly={iconOnly} prompt={t("扫描工单码或设备序列号")} inputLabel={t("工单号 / SN / IMEI")} manualAction={t("查找工单")} renderResult={(raw,actions)=><RepairScanResults raw={raw} {...actions}/>} />;
}
