"use client";
import{useState,type ReactNode}from'react';
import{ScanLine,X,ChevronRight}from'lucide-react';
import{NavigationLink as Link}from'@/components/navigation-link';
import{useLanguage}from'@/components/language-provider';
import{useBackendState}from'@/components/backend-snapshot';
import{SelectControl}from'@/components/select-control';
import{IdentifierField}from'@/components/identifier-field';
import{WindowedListRows}from'@/components/windowed-list-rows';
import{ListPagination}from'@/components/list-pagination';
import{ReadFailure,ReadPending}from'@/components/page-recovery';
import{useIdentifierCandidates}from'@/components/use-identifier-candidates';
import{identifierScanValue}from'@/lib/identifier-scan';
import{lookupRetailCode,normalizeIdentifier,retailStatuses,type RetailUnit,type RetailCodeType}from'@/lib/retail';
import{retailHistoryCode,retailHistoryStatus,type RetailHistoryRecord}from'@/lib/retail-history';
import{retailRecordHref}from'@/lib/retail-record';
import type{RetailScanQuery,RetailScanItem}from'@/lib/backend/retail-scan-contract';
import type{BackendReadScope}from'@/lib/backend/read-plan';
import styles from'./retail-list.module.css';
import surface from'./retail-surface.module.css';
function RetailScannerBody({onClose,children}:{onClose:()=>void;children:(result:RetailScanQuery)=>ReactNode}){
 const{t,systemText}=useLanguage(),[scanCode,setScanCode]=useState(''),[kind,setKind]=useState<RetailCodeType>('internal'),[error,setError]=useState(''),[result,setResult]=useState<RetailScanQuery|null>(null);
 return <section className={'panel '+styles.scan} aria-label={t('识码查找')}><div className={'detail-section__head '+surface.sectionHead}><div><span><ScanLine size={18}/></span><h3>{t('识码查找')}</h3></div><button className="icon-button" type="button" aria-label={t('收起识码查找')} onClick={onClose}><X size={17}/></button></div><form onSubmit={event=>{event.preventDefault();const raw=scanCode.trim(),checked=kind==='imei'?identifierScanValue(raw,'imei'):null;if(checked?.error){setError(checked.error);setResult(null);return;}setError('');setResult({raw:checked?.value??raw,kind});}}><label className="field"><span>{t('码类型')}</span><SelectControl aria-label={t('码类型')} value={kind} onChange={event=>{setKind(event.target.value as RetailCodeType);setResult(null);setError('');}}><option value="internal">{t('内部单机码')}</option><option value="serial">{t('SN 序列号')}</option><option value="imei">IMEI</option><option value="product">{t('包装商品码')}</option></SelectControl></label><IdentifierField required error={systemText(error)} label={t('识别内容')} value={scanCode} onChange={value=>{setScanCode(value);setResult(null);setError('');}} kind={kind==='imei'?'imei':'serial'} placeholder={kind==='imei'?t('15 位数字'):t('输入或扫码填入识别内容')}/><button className="button button--primary" type="submit">{t('查找候选')}</button></form>{error?<p className="form-error" role="alert">{systemText(error)}</p>:null}{result?.raw?children(result):result?<p>{t('请输入识别内容。')}</p>:null}</section>;
}
function RetailScannerResults({query,items,total,ready=true,pending=false,error='',retry,onNavigate,returnTo,startIndex=0,extent,version,resetKey='',loadMore,seek}:{query:RetailScanQuery;items:RetailScanItem[];total:number;ready?:boolean;pending?:boolean;error?:string;retry?:()=>void;onNavigate:(id:string)=>void;returnTo?:string;startIndex?:number;extent?:number;version?:string;resetKey?:string;loadMore?:()=>void;seek?:(position:number)=>void}){
 const{t}=useLanguage(),backend=useBackendState();
 return <div className={styles.scanResult} data-retail-scan aria-busy={pending}>{error?<ReadFailure message={error} pending={pending} onRetry={retry}/>:null}{!ready?(pending?<ReadPending label="正在处理…"/>:null):total?<><p>{query.kind==='product'?t('包装码只对应候选，需核对具体实物。'):t('请选择核对后的单机档案。')}{t('共 ')}{total} {t(' 台')}</p><WindowedListRows key={resetKey} active={!backend.formal||backend.active} items={items} startIndex={startIndex} total={total} extent={extent} version={version} rowKey={row=>row.key} onSeek={seek} pending={pending} render={(item,props)=><Link {...props} className={styles.scanCandidate} href={retailRecordHref(item.id,returnTo,item.source)} onClick={()=>onNavigate(item.key)}>{item.code}{item.previews?.includes('code')?'…':''} · {item.title}{item.previews?.includes('title')?'…':''}<span>{item.previews?.includes('status')?item.status+'…':t(item.status)}<ChevronRight size={16}/></span></Link>}/><ListPagination start={startIndex} shown={startIndex+items.length} total={total} hasMore={startIndex+items.length<total} onLoadMore={()=>loadMore?.()} loading={pending} error={Boolean(error)} resetKey={resetKey}/></>:<><p role="status">{t('未找到匹配。新建前请核对码类型与实物；不会自动创建。')}</p><Link className="button button--secondary" href={'/app/retail/new?identifier='+encodeURIComponent(query.raw)+'&kind='+query.kind} onClick={()=>onNavigate('')}>{t('用此码新建档案')}</Link></>}</div>;
}
export function RetailRecordScanner({units,records,onClose,onNavigate}:{units:RetailUnit[];records:RetailHistoryRecord[];onClose:()=>void;onNavigate:()=>void}){
 const managed=new Set(units.flatMap(unit=>unit.historyOrigin?[unit.historyOrigin.recordId]:[]));
 return <RetailScannerBody onClose={onClose}>{query=>{
  const candidates=lookupRetailCode(units,query.raw,query.kind).map(unit=>({key:'unit:'+unit.id,id:unit.id,source:'unit' as const,code:unit.code,title:[unit.brand,unit.model].filter(Boolean).join(' '),status:retailStatuses[unit.status].label})),history=records.filter(record=>!managed.has(record.id)&&normalizeIdentifier(query.kind==='internal'?retailHistoryCode(record):record.identifier||'')===normalizeIdentifier(query.raw)).map(record=>({key:'history:'+record.id,id:record.id,source:'history' as const,code:retailHistoryCode(record),title:[record.brand,record.model].filter(Boolean).join(' '),status:retailHistoryStatus(record)}));
  const items=[...candidates,...history];return <RetailScannerResults query={query} items={items} total={items.length} onNavigate={onNavigate}/>;
 }}</RetailScannerBody>;
}
const scanRowKey=(row:RetailScanItem)=>row.key;
function FormalScanResults({scope,query,onNavigate,returnTo}:{scope:BackendReadScope;query:RetailScanQuery;onNavigate:(id:string)=>void;returnTo:string}){
 const backend=useBackendState(),raw=JSON.stringify(query),remote=useIdentifierCandidates<RetailScanItem>(scope,'/api/backend/v2/retail/scan',raw,backend.snapshot?.revision??0,50,scanRowKey);
 return <RetailScannerResults query={query} items={remote.page?.items??[]} total={remote.page?.total??0} ready={Boolean(remote.page)} pending={remote.pending} error={remote.error} retry={remote.retry} onNavigate={onNavigate} returnTo={returnTo} startIndex={remote.page?.startIndex} extent={remote.extent} version={remote.page?.stateToken} resetKey={remote.key} loadMore={remote.loadMore} seek={remote.seek}/>;
}
export function FormalRetailRecordScanner({scope,onClose,onNavigate,returnTo}:{scope:BackendReadScope;onClose:()=>void;onNavigate:(id:string)=>void;returnTo:string}){return <RetailScannerBody onClose={onClose}>{query=><FormalScanResults scope={scope} query={query} onNavigate={onNavigate} returnTo={returnTo}/>}</RetailScannerBody>;}
