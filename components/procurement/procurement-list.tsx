"use client";
import {useState} from "react";
import {useLanguage} from "@/components/language-provider";
import {useBackendState} from "@/components/backend-snapshot";
import {useRepairDirectory} from "@/components/repairs/local-intake-store";
import {SelectControl} from "@/components/select-control";
import {useListWindow} from "@/components/list-pagination";
import {arrivedQuantity,isPreorder,procurementStatus,type ProcurementRecord} from "@/lib/procurement";
import type {ProcurementListQuery,ProcurementListSummary} from "@/lib/backend/procurement-list-contract";
import {useProcurement} from "./procurement-provider";
import {FormalProcurementList} from "./formal-procurement-list";
import {ProcurementListBody} from "./procurement-list-body";
export function ProcurementList({initialRepairId=""}:{initialRepairId?:string}) {
 const backend=useBackendState();return backend.formal&&backend.snapshot?.procurementListEnabled?<FormalProcurementList/>:<LegacyProcurementList initialRepairId={initialRepairId}/>;
}
const matches=(row:ProcurementRecord,filter:ProcurementListQuery["filter"])=>filter==="all"||(filter==="draft"?isPreorder(row):filter==="open"?["ordered","partial"].includes(procurementStatus(row)):procurementStatus(row)===filter);
function LegacyProcurementList({initialRepairId}:{initialRepairId:string}) {
 const {t}=useLanguage(),{records,listView,dispatch}=useProcurement(),orders=useRepairDirectory();
 const [query,setQuery]=useState<ProcurementListQuery>({q:listView.query,filter:listView.filter,repairId:initialRepairId||listView.repairId,groupBy:listView.groupBy as ProcurementListQuery["groupBy"]});
 const filtered=records.filter(row=>matches(row,query.filter)&&(!query.repairId||row.repairId===query.repairId)&&[row.id,row.item,row.supplier,row.repairId,orders.find(order=>order.id===row.repairId)?.device.model].join(" ").toLowerCase().includes(query.q.trim().toLowerCase()));
 const groups=new Map<string,ProcurementRecord[]>();for(const row of filtered){const status=procurementStatus(row),group=query.groupBy==="status"?status==="cart"?"draft":status:query.groupBy==="supplier"?row.supplier:query.groupBy==="repair"?row.repairId:"all";const entries=groups.get(group)??[];entries.push(row);groups.set(group,entries);}
 const summaries:ProcurementListSummary[]=[...groups.values()].flatMap(rows=>rows.map(row=>({id:row.id,repairId:row.repairId,repairModel:orders.find(order=>order.id===row.repairId)?.device.model??null,item:row.item,supplier:row.supplier,quantity:row.quantity,arrived:arrivedQuantity(row),status:procurementStatus(row),expectedAt:row.expectedAt,ledgerRevision:row.events.length,groupKey:rows[0].id,groupFirst:rows[0].id,groupCount:rows.length})));
 const window=useListWindow(summaries.length,JSON.stringify(query)),remember=()=>dispatch({type:"list-view",view:{query:query.q,filter:query.filter,repairId:query.repairId,groupBy:query.groupBy}});
 return <ProcurementListBody query={query} update={value=>setQuery(current=>({...current,...value}))} items={summaries.slice(0,window.limit)} total={summaries.length} groupTotal={groups.size} stats={{all:records.length,draft:records.filter(row=>matches(row,"draft")).length,open:records.filter(row=>matches(row,"open")).length,complete:records.filter(row=>matches(row,"complete")).length}} ready hasMore={window.limit<summaries.length} loadMore={window.loadMore} resetKey={window.resetKey} onRemember={()=>void remember()} repairFilter={<label className="module-select"><SelectControl aria-label={t("关联工单筛选")} value={orders.some(row=>row.id===query.repairId)?query.repairId:""} onChange={event=>setQuery(current=>({...current,repairId:event.target.value}))}><option value="">{t("全部工单")}</option>{orders.map(row=><option value={row.id} key={row.id}>{row.id}</option>)}</SelectControl></label>}/>;
}
