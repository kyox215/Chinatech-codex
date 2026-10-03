"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePageQuery, QueryNotice, PageControls } from "@/components/backend-query";
import { useBackendLookup } from "@/components/backend-lookup";
import { buildCustomerDevices } from "@/lib/customer-devices";
import { Search, Smartphone, Tablet, Laptop, Gamepad2, CircleHelp, History, Wrench, ShoppingBag } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRetail } from "@/components/backend-domain-context";
import { customerId } from "@/lib/customers";
function profileHref(phone: string) { try { return `/app/customers/${customerId(phone)}`; } catch { return "/app/customers"; } }
type DeviceRecord = { key: string; category: string; model: string; serial: string; records: { id: string; phone: string; time: string; type: "repair" | "sale"; href: string }[] };
const deviceIcons: Record<string, typeof Smartphone> = { 手机: Smartphone, 平板: Tablet, 电脑: Laptop, 游戏机: Gamepad2, phone: Smartphone, tablet: Tablet, laptop: Laptop, desktop: Laptop, console: Gamepad2 };
function latestDeviceTime(device: DeviceRecord) { return device.records.reduce((latest, record) => record.time > latest ? record.time : latest, ""); }
export function CustomerDevices() {
  const repairs = useRepairDirectory(); const { units } = useRetail(); const params=useSearchParams();const [query, setQuery] = useState(params.get("q")??"");
  const devices=buildCustomerDevices(repairs,units);
  const localRows = devices.filter(device => `${device.model} ${device.serial} ${device.records.map(row => `${row.phone} ${row.id}`).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => latestDeviceTime(b).localeCompare(latestDeviceTime(a)));
  const [pageState,setPageState]=useState({query,page:Number(params.get("page")||1)});const page=pageState.query===query?pageState.page:1;const qp=new URLSearchParams();if(query)qp.set("q",query);if(page>1)qp.set("page",String(page));
  const serverQuery=usePageQuery(`/app/customer-devices${qp.size?`?${qp}`:""}`);const remote=serverQuery.state?.views?.devices;const rows=remote?.rows??localRows;
  return <main className="module-page"><header className="module-heading"><PageTitle title="客户设备" /><Link className="button button--secondary button--compact" href="/app/customers">客户档案</Link></header><QueryNotice query={serverQuery}/><section className="panel customer-device-panel"><label className="module-search"><Search size={18} /><input aria-label="搜索客户设备" value={query} onChange={event => setQuery(event.target.value)} placeholder="型号、SN / IMEI、手机号" /></label><div className="customer-device-grid">{rows.map(device => { const Icon = deviceIcons[device.category] ?? CircleHelp; return <article className="customer-device-card" key={device.key}><header><span className="device-glyph"><Icon size={20} /></span><div><strong>{device.model}</strong><small>SN / IMEI：{device.serial || "未记录"}</small></div></header><DeviceRecords device={device} count={"recordCount" in device?Number(device.recordCount):device.records.length}/></article>; })}</div>{!rows.length ? <div className="module-empty"><Smartphone size={28} /><strong>没有匹配的设备</strong></div> : null}{remote?<PageControls page={remote.page} pageCount={remote.pageCount} onPage={page=>setPageState({query,page})}/>:null}</section></main>;
}

function DeviceRecords({device,count}:{device:DeviceRecord;count:number}) {const [open,setOpen]=useState(false);return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary><History size={16}/>设备记录 <small>{count}</small></summary>{open?<DeviceRecordRows device={device}/>:null}</details>;}
function DeviceRecordRows({device}:{device:DeviceRecord}) {const [page,setPage]=useState(1);const lookup=useBackendLookup<DeviceRecord["records"][number]>("deviceRecords",device.key,"internal",page);const rows=lookup.backend?lookup.rows:device.records.toSorted((a,b)=>b.time.localeCompare(a.time));return <>{lookup.loading?<p role="status">正在读取关联历史…</p>:lookup.error?<p className="form-error" role="alert">{lookup.error}</p>:rows.map((row,index)=><div key={`${row.type}-${row.id}-${index}`}><Link href={row.href}>{row.type==="repair"?<Wrench size={15}/>:<ShoppingBag size={15}/>} {row.id}</Link><small>{row.time}</small><Link href={profileHref(row.phone)}>{row.phone}</Link></div>)}<PageControls page={lookup.page} pageCount={lookup.pageCount} onPage={setPage}/></>;}
