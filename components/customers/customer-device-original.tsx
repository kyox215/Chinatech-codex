"use client";
import{useEffect,useRef,useState}from'react';
import{useLanguage}from'@/components/language-provider';
import{ReadFailure,ReadPending}from'@/components/page-recovery';
import type{CustomerDeviceSummary}from'@/lib/backend/customer-device-contract';
import{useCustomerDevicePage}from'./use-customer-device-page';
function DeviceOriginalFacts({deviceId,version}:{deviceId:string;version:string}){
 const{t}=useLanguage(),page=useCustomerDevicePage<CustomerDeviceSummary>({kind:'original',deviceId,q:''}),value=page.page?.items[0],previousVersion=useRef(version);
 useEffect(()=>{if(previousVersion.current!==version){previousVersion.current=version;page.retry();}},[version,page]);
 return <div className="customer-device-original">{page.error?<ReadFailure message={page.error} pending={page.pending} onRetry={page.retry}/>:null}{!page.page&&!page.error&&page.pending?<ReadPending label="正在读取客户设备…"/>:null}{value?<><strong>{value.model}</strong><small>SN / IMEI：{value.serial||t('未记录')}</small></>:page.page?<small>{t('暂无记录')}</small>:null}</div>;
}
export function CustomerDeviceOriginal({deviceId,version}:{deviceId:string;version:string}){const{t}=useLanguage(),[open,setOpen]=useState(false);return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>{t('完整型号')}</summary>{open?<DeviceOriginalFacts deviceId={deviceId} version={version}/>:null}</details>;}
