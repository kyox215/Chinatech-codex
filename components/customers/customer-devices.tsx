"use client";
import { InputControl } from "@/components/input-control";
import Link from "next/link";
import { useState } from "react";
import { Search, Smartphone, Tablet, Laptop, Gamepad2, CircleHelp, History, Wrench, ShoppingBag } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRetail } from "@/components/retail/retail-provider";
import { customerId } from "@/lib/customers";
function profileHref(phone: string) { try { return `/app/customers/${customerId(phone)}`; } catch { return "/app/customers"; } }
type DeviceRecord = { key: string; category: string; model: string; serial: string; records: { id: string; phone: string; time: string; type: "repair" | "sale"; href: string }[] };
const deviceIcons: Record<string, typeof Smartphone> = { 手机: Smartphone, 平板: Tablet, 电脑: Laptop, 游戏机: Gamepad2, phone: Smartphone, tablet: Tablet, laptop: Laptop, desktop: Laptop, console: Gamepad2 };
function latestDeviceTime(device: DeviceRecord) { return device.records.reduce((latest, record) => record.time > latest ? record.time : latest, ""); }
export function CustomerDevices() {
  const repairs = useRepairDirectory(); const { units } = useRetail(); const [query, setQuery] = useState("");
  const devices = new Map<string, DeviceRecord>();
  for (const repair of repairs) {
    const serial = repair.device.serial.trim().toUpperCase().replace(/\s/g, "");
    const key = serial ? `${/^\d{15}$/.test(serial) ? "IMEI" : repair.device.brand.trim().toUpperCase()}:${serial}` : `repair:${repair.id}`;
    const device = devices.get(key) ?? { key, category: repair.device.category, model: `${repair.device.brand} ${repair.device.model}`, serial, records: [] };
    device.records.push({ id: repair.id, phone: repair.customer.phone, time: repair.createdAt, type: "repair", href: `/app/repairs/${repair.id}` }); devices.set(key, device);
  }
  for (const unit of units) for (const sale of unit.sales) {
    if (!sale.customerPhone) continue;
    // A sold store unit stays a separate physical identity; no merge from model alone.
    const key = `retail:${unit.id}`;
    const device = devices.get(key) ?? { key, category: unit.category, model: `${unit.brand} ${unit.model}`, serial: unit.imei1 || unit.serial || unit.code, records: [] };
    device.records.push({ id: unit.code, phone: sale.customerPhone, time: sale.time, type: "sale", href: `/app/retail/units/${unit.id}` }); devices.set(key, device);
  }
  const rows = [...devices.values()].filter(device => `${device.model} ${device.serial} ${device.records.map(row => `${row.phone} ${row.id}`).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => latestDeviceTime(b).localeCompare(latestDeviceTime(a)));
  return <main className="module-page"><header className="module-heading"><PageTitle title="客户设备" /><Link className="button button--secondary button--compact" href="/app/customers">客户档案</Link></header><section className="panel customer-device-panel"><label className="module-search"><Search size={18} /><InputControl onClear={() => setQuery("")} clearLabel="清空搜索客户设备" aria-label="搜索客户设备" value={query} onChange={event => setQuery(event.target.value)} placeholder="型号、SN / IMEI、手机号" /></label><div className="customer-device-grid">{rows.map(device => { const Icon = deviceIcons[device.category] ?? CircleHelp; return <article className="customer-device-card" key={device.key}><header><span className="device-glyph"><Icon size={20} /></span><div><strong>{device.model}</strong><small>SN / IMEI：{device.serial || "未记录"}</small></div></header><details><summary><History size={16} />设备记录 <small>{device.records.length}</small></summary>{device.records.toSorted((a,b) => b.time.localeCompare(a.time)).map((row,index) => <div key={`${row.type}-${row.id}-${index}`}><Link href={row.href}>{row.type === "repair" ? <Wrench size={15} /> : <ShoppingBag size={15} />}{row.id}</Link><small>{row.time}</small><Link href={profileHref(row.phone)}>{row.phone}</Link></div>)}</details></article>; })}</div>{!rows.length ? <div className="module-empty"><Smartphone size={28} /><strong>没有匹配的设备</strong></div> : null}</section></main>;
}
