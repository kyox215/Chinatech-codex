"use client";
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchCombobox, type ComboboxOption } from '@/components/search-combobox';
import { useLanguage } from '@/components/language-provider';
import { catalogCategory, catalogBrandAliases, canonicalCatalogBrand, catalogNormalize, catalogSearchTerms, type CatalogPage } from '@/lib/device-catalog';
import { useCatalogRead } from './use-catalog';
import styles from './device-catalog.module.css';
type Groups={revision:string;brands:{value:string;total:number}[];families:{value:string;total:number}[]};
type Props={category:string;brand?:string;field:'brand'|'model';label:string;value:string;onChange:(value:string)=>void;required?:boolean;maxLength?:number;disabled?:boolean;historicalOptions?:readonly ComboboxOption[]};
export function DeviceCatalogControl(props:Props){return <CatalogControl key={props.category+':'+(props.field==='model'?canonicalCatalogBrand(props.brand??''):'')} {...props}/>;}
function CatalogControl({category,brand='',field,label,value,onChange,required=false,maxLength,disabled=false,historicalOptions=[]}:Props){
  const {t,systemText}=useLanguage();const [open,setOpen]=useState(false);const [family,setFamily]=useState('');const [page,setPage]=useState(1);
  const canonical=canonicalCatalogBrand(brand);const selectedCategory=category==='all'?'':category==='电脑'?'computer':catalogCategory(category)??'other';
  const groups=useCatalogRead<Groups>({kind:'groups',category:selectedCategory,brand:field==='model'?canonical:'',q:field==='brand'?value:''},open&&!disabled);
  const models=useCatalogRead<CatalogPage>({kind:'models',category:selectedCategory,brand:canonical,family,q:value,page:String(page)},open&&!disabled&&field==='model');
  const loading=field==='brand'?groups.loading:models.loading;const error=groups.error||models.error;
  const terms=catalogSearchTerms(value);
  const official:ComboboxOption[]=field==='brand'?(groups.data?.brands??[]).filter(row=>terms.every(term=>catalogBrandAliases(row.value).some(alias=>catalogNormalize(alias).includes(term)))).map(row=>({value:row.value,label:row.value,detail:catalogBrandAliases(row.value).filter(alias=>alias!==row.value).join(' · ')})):(models.data?.rows??[]).map(row=>({value:row.name,label:row.name,detail:[row.network==='unknown'?'':row.network,row.year?String(row.year):'',row.platform,...row.modelCodes.slice(0,3),row.status==='review'?t('待核对'):''].filter(Boolean).join(' · ')}));
  const seen=new Set(official.map(row=>catalogNormalize(row.value)));
  const local=historicalOptions.filter(row=>!seen.has(catalogNormalize(row.value))&&terms.every(term=>catalogNormalize(row.value+' '+(row.detail??'')).includes(term))).slice(0,10).map(row=>({...row,detail:t('门店原文 · 实物仍须核对')}));
  const options=[...official,...local].slice(0,50);
  const total=models.data?.total??0;const pages=Math.max(1,Math.ceil(total/50));
  return <SearchCombobox label={t(label)} value={value} onChange={next=>{onChange(next);if(field==='model')setFamily('');setPage(1);}} options={options} optionDetailsAsDescription onOpenChange={setOpen} filterOptions={false} optionLimit={50} menuClassName={styles.menu} loading={open&&loading} required={required} maxLength={maxLength??(field==='brand'?60:120)} disabled={disabled} placeholder={t('搜索或手动填写')} validate={current=>required&&!current.trim()?field==='brand'?'请选择或填写设备品牌。':'请选择或填写实物型号。':''}
    menuHeader={field==='model'&&groups.data?.families.length?<div className={styles.families} role="group" aria-label={t('型号系列筛选')}><button type="button" aria-pressed={!family} onMouseDown={event=>event.preventDefault()} onClick={()=>{setFamily('');setPage(1);}}>{t('全部系列')}</button>{groups.data.families.map(row=><button key={row.value} type="button" aria-pressed={family===row.value} onMouseDown={event=>event.preventDefault()} onClick={()=>{setFamily(row.value);setPage(1);}}>{row.value}</button>)}</div>:null}
    menuFooter={<div className={[styles.footer,field==='model'&&pages>1&&!error?styles.pageFooter:''].filter(Boolean).join(' ')}>{error?<><p role="status">{systemText(error)} {t('仍可手动填写。')}</p><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{groups.retry();models.retry();}}>{t('重新查询目录')}</button></>:field==='model'&&pages>1?<><span className={styles.pageCount}>{t('第 {v0} / {v1} 页 · {v2} 个型号',{v0:page,v1:pages,v2:total})}</span><button type="button" disabled={page<=1||loading} onMouseDown={event=>event.preventDefault()} onClick={()=>setPage(previous=>previous-1)} aria-label={t('上一页')} title={t('上一页')}><span className={styles.footerText}>{t('上一页')}</span><ChevronLeft className={styles.footerIcon} size={18} aria-hidden="true" /></button><button type="button" disabled={page>=pages||loading} onMouseDown={event=>event.preventDefault()} onClick={()=>setPage(previous=>previous+1)} aria-label={t('下一页')} title={t('下一页')}><span className={styles.footerText}>{t('下一页')}</span><ChevronRight className={styles.footerIcon} size={18} aria-hidden="true" /></button></>:null}</div>} />;
}
