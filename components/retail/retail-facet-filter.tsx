"use client";
import{useCallback,useEffect,useLayoutEffect,useRef,useState}from'react';
import{SearchCombobox}from'@/components/search-combobox';
import{useLanguage}from'@/components/language-provider';
import{useActivityFeedback}from'@/components/operation-feedback';
import{ReadFailure}from'@/components/page-recovery';
import{backendScopeKey,type BackendReadScope}from'@/lib/backend/read-plan';
import type{RetailFacet,RetailFacetQuery}from'@/lib/backend/retail-list-contract';
import styles from'./retail-history.module.css';
import{requestRetailFacets}from'./retail-read-client';
export function RetailFacetFilter({scope,view,kind,value,selected,onChange}:{scope:BackendReadScope;view:RetailFacetQuery['view'];kind:RetailFacetQuery['kind'];value:string;selected?:RetailFacet;onChange:(key:string)=>void}){
 const{t}=useLanguage(),[open,setOpen]=useState(false),[q,setQuery]=useState(''),[retry,setRetry]=useState(0),scopeKey=backendScopeKey(scope),key=JSON.stringify([scopeKey,view,kind,q]),[data,setData]=useState<{key:string;scopeKey:string;view:string;kind:string;items:RetailFacet[];total:number}|null>(null),[status,setStatus]=useState({key,pending:false,error:''}),latest=useRef(key);
 useLayoutEffect(()=>{latest.current=key;},[key]);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController(),expected=key,query={view,kind,q,key:'all'};let live=true;
  const timeout=setTimeout(()=>{if(!live)return;setStatus({key:expected,pending:true,error:''});void requestRetailFacets(scope,query,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(page=>{if(live&&latest.current===expected)setData({key:expected,scopeKey,view,kind,items:page.items,total:page.total});}).catch(error=>{if(live&&!controller.signal.aborted&&latest.current===expected)setStatus({key:expected,pending:false,error:error instanceof Error?error.message:'后台资料暂不可用。'});}).finally(()=>{if(live&&!controller.signal.aborted&&latest.current===expected)setStatus(previous=>previous.key===expected?{...previous,pending:false}:previous);});},150);
  return()=>{live=false;clearTimeout(timeout);controller.abort();};
 },[scope,scopeKey,view,kind,q,key,open,retry]);
 const pending=open&&status.key===key&&status.pending,error=status.key===key?status.error:'',visible=data?.key===key?data:null,all=kind==='category'?t('全部类型'):t('全部其他状态'),label=kind==='category'?t('商品类型筛选'):t('其他状态筛选');
 useActivityFeedback(pending,{kind:'read'});
 const onOpenChange=useCallback((value:boolean)=>{setOpen(value);if(!value)setStatus(previous=>previous.pending?{...previous,pending:false}:previous);},[]);
 const selectedValue=(selected?.key===value?selected:undefined)??(data?.scopeKey===scopeKey&&data.view===view&&data.kind===kind?data.items.find(item=>item.key===value):undefined);
 const options=[{value:'all',label:all},...(visible?.items??[]).map(row=>({value:row.key,label:row.preview?row.label+'…':t(row.label),detail:String(row.count)}))];
 if(value!=='all'&&!options.some(option=>option.value===value))options.push({value,label:selectedValue?selectedValue.preview?selectedValue.label+'…':t(selectedValue.label):t('待核对')});
 return <div className={styles.facet}><SearchCombobox hideLabel label={label} inputLabel={label} value={value} onChange={next=>{if(next==='')onChange('all');}} onSelect={option=>onChange(option.value)} onQueryChange={setQuery} onOpenChange={onOpenChange} optionLimit={13} options={options} filterOptions={false} displaySelectedLabel commitOnBlur showAllOnOpen maxLength={160} loading={pending} loadingLabel={t('正在处理…')} emptyText={null} menuHeader={visible?`${visible.total} ${t(' 条')}`:undefined}/>{error?<ReadFailure message={error} pending={pending} onRetry={()=>setRetry(value=>value+1)}/>:null}</div>;
}
