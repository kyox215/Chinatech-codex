"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import{useId,useState,type ReactNode}from'react';
import{Archive,ChevronRight,Plus,ScanLine,Search,X}from'lucide-react';
import{useLanguage}from'@/components/language-provider';
import{useBackendState}from'@/components/backend-snapshot';
import{InputControl}from'@/components/input-control';
import{NavigationLink as Link}from'@/components/navigation-link';
import{PageTitle}from'@/components/page-title';
import{SelectControl}from'@/components/select-control';
import{ReadPending,ReadFailure}from'@/components/page-recovery';
import{ListPagination}from'@/components/list-pagination';
import{WindowedListRows}from'@/components/windowed-list-rows';
import{useStaff}from'@/components/staff/use-staff';
import{retailDisplaySpec}from'@/lib/i18n/retail-display';
import{defaultRetailListSort,retailViewLabels,type RetailView}from'@/lib/retail-list-model';
import type{RetailListQuery,RetailListSummary,RetailListPage}from'@/lib/backend/retail-list-contract';
import{retailRecordHref}from'@/lib/retail-record';
import{retailListLocation,rememberRetailListPosition}from'@/lib/retail-list-location';
import{historyDate,historyMoney}from'./retail-history-shared';
import styles from'./retail-history.module.css';
import listStyles from'./retail-list.module.css';
import surface from'./retail-surface.module.css';
/** One existing retail page/row template. Legacy canonical data and bounded
 * server summaries adapt to these same visible facts and controls. */
export function RetailListBody({query,rowsQuery=query,items,total,viewCounts,conditionCounts,ready,error,pending=false,retry,update,clear,categoryFilter,statusFilter,renderScanner,listUrl,onRemember,hasMore,loadMore,startIndex=0,extent,version,resetKey,anchor,offset=0,scopeKey='',rememberAnchor,seek,loadPrevious}:{
 query:RetailListQuery;rowsQuery?:RetailListQuery;items:RetailListSummary[];total:number;viewCounts?:RetailListPage['viewCounts'];conditionCounts?:RetailListPage['conditionCounts'];ready:boolean;error:string;pending?:boolean;retry?:()=>void;update:(value:Partial<RetailListQuery>)=>void;clear:()=>void;categoryFilter:ReactNode;statusFilter?:ReactNode;renderScanner:(onClose:()=>void)=>ReactNode;listUrl:string;onRemember?:()=>void;hasMore:boolean;loadMore:()=>void;startIndex?:number;extent?:number;version?:string;resetKey:string;anchor?:string;offset?:number;scopeKey?:string;rememberAnchor?:(key:string)=>void;seek?:(index:number)=>void;loadPrevious?:()=>void;
}){
 const{t,locale}=useLanguage(),staff=useStaff(),backend=useBackendState(),[scanOpen,setScanOpen]=useState(false),[filtersOpen,setFiltersOpen]=useState(false),filtersId=useId(),{view,condition,q,category,status,review,sort}=query;
 const filterCount=Number(category!=='all')+Number(status!=='all')+Number(review)+Number(sort!==defaultRetailListSort(view));
 const hasFilters=Boolean(q)||condition!=='all'||category!=='all'||status!=='all'||review||sort!==defaultRetailListSort(view),viewHref=(value:RetailView)=>'/app/retail'+(value==='available'?'':'?view='+value);
 return <main className={`module-page ${surface.page}`}>
  <header className="module-heading"><PageTitle title={t('整机商品')}/><div className={`module-heading__actions${!staff.can('retail.edit')?' module-heading__actions--icons':''}`}><button className="button button--secondary button--compact page-toolbar-action" type="button" aria-label={t('识码查找')} title={t('识码查找')} aria-expanded={scanOpen} onClick={()=>setScanOpen(!scanOpen)}><ScanLine size={17}/><span>{t('识码查找')}</span></button>{staff.can('retail.edit')?<Link className="button button--primary button--compact" href="/app/retail/new" icon={<Plus size={17}/>}>{t('新建商品')}</Link>:null}</div></header>
  {scanOpen?renderScanner(()=>setScanOpen(false)):null}
  <nav className={styles.sourceTabs} aria-label={t('整机销售状态')}>{(['available','sold','other']as const).map(value=><Link key={value} href={viewHref(value)} aria-current={view===value?'page':undefined}><span className={styles.sourceLabel}>{t(retailViewLabels[value])}</span><span>{viewCounts?.[value]??'—'}</span></Link>)}</nav>
  <section className={`panel ${styles.list}`} aria-label={t(retailViewLabels[view])} aria-busy={pending}>
   <div className={`${listStyles.classification} ${styles.classificationBar}`} role="group" aria-label={t('商品分类筛选')}>{(['all','新机','翻新机']as const).map(value=><button key={value} type="button" className={condition===value?listStyles.classificationActive:''} aria-pressed={condition===value} onClick={()=>update({condition:value})}><span>{value==='all'?t('全部'):t(value)}</span><small>{conditionCounts?.[value]??'—'}</small></button>)}</div>
   <div className={styles.toolbar}><label className={`module-search ${styles.search}`}><Search size={18}/><InputControl maxLength={160} onClear={()=>update({q:''})} clearLabel={t('清空搜索整机商品')} type="search" aria-label={t('搜索整机商品')} value={q} onChange={event=>update({q:event.target.value})} placeholder={t('型号、号码、识别码、颜色、容量、问题或日期')}/></label><button className={`button button--secondary ${styles.filterToggle}`} type="button" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={()=>setFiltersOpen(value=>!value)}>{t('筛选')}{filterCount?` · ${filterCount}`:''}</button><div id={filtersId} className={styles.filters} hidden={!filtersOpen}>{categoryFilter}{view==='other'?statusFilter:null}<label className="module-select"><SelectControl aria-label={t('整机核对筛选')} value={review?'pending':'all'} onChange={event=>update({review:event.target.value==='pending'})}><option value="all">{t('全部核对状态')}</option><option value="pending">{t('待核对')}</option></SelectControl></label><label className="module-select"><SelectControl aria-label={t('整机排序')} value={sort} onChange={event=>update({sort:event.target.value as RetailListQuery['sort']})}><option value="name-asc">{t('名称 A–Z')}</option>{view==='sold'?<option value="sold-newest">{t('最近售出')}</option>:null}<option value="newest">{t('最近入库')}</option><option value="oldest">{t('最早入库')}</option><option value="price-asc">{t('标价升序')}</option><option value="price-desc">{t('标价降序')}</option></SelectControl></label></div></div>
   <div className={styles.summary}><span>{t(retailViewLabels[view])} · {ready?total:'—'} {t(' 条')}{condition!=='all'?` · ${t(condition)}`:''}</span>{hasFilters?<button type="button" onClick={clear}><X size={15}/>{t('清除筛选')}</button>:null}</div>
   {error?<ReadFailure message={error} pending={pending} onRetry={retry}/>:null}
   {!ready?(pending?<ReadPending label="正在读取整机商品…"/>:null):<>
    <div className={`module-table-scroll ${styles.table}`} role="region" aria-label={t('整机商品表格')} tabIndex={0}>
     <div className={styles.tableHead} aria-hidden="true"><span>{t('商品 / 规格')}</span><span>{t('客户 / 识别码')}</span><span>{t('入库 / 拿走日期')}</span><span>{t('标价 / 成交价')}</span><span>{t('状态')}</span><span/></div>
     <WindowedListRows key={resetKey} active={!backend.formal||backend.active} items={items} startIndex={startIndex} total={total} extent={extent} version={version} initialAnchor={anchor} initialOffset={Number.isFinite(offset)?Math.max(-2000,Math.min(2000,offset)):0} rowKey={row=>row.key} onAnchor={row=>rememberAnchor?.(row.key)} onSeek={seek} onLoadPrevious={loadPrevious} pending={pending} render={(item,rowProps)=>{
      const preview=(key:string,value:string|null)=>value===null?null:value+(item.previews?.includes(key)?'…':'');
      const facts=item.specificationFacts,spec=facts?retailDisplaySpec({...facts,edition:preview('edition',facts.edition)!},locale):preview('specification',item.specification),location=scopeKey?retailListLocation(rowsQuery,item.key):listUrl;
      return <Link {...rowProps} className={`${styles.row}${!item.phone?.trim()&&!item.identifier?.trim()?` ${styles.rowWithoutIdentity}`:''}`} href={retailRecordHref(item.id,location,item.source)} onClick={event=>{if(scopeKey){const location=retailListLocation(rowsQuery,item.key,event.currentTarget.getBoundingClientRect().top);rememberRetailListPosition(scopeKey,item.key,location);replaceBackendDocumentUrl(location);}onRemember?.();}} icon={<ChevronRight size={17}/>} iconClassName={styles.arrow} iconPosition="end">
       <div className={styles.product}><strong>{item.title==='商品名称未记录'?t(item.title):preview('title',item.title)}</strong>{item.color?.trim()||item.specification?.trim()?<small>{[item.color?item.previews?.includes('color')?preview('color',item.color):t(item.color):'',spec].filter(value=>value?.trim()).join(' · ')}</small>:null}</div>
       <div className={styles.identity}>{item.phone?.trim()?<span>{preview('phone',item.phone)}</span>:null}{item.identifier?.trim()?<small>{preview('identifier',item.identifier)}</small>:null}</div>
       <div className={styles.dates}>{item.intakeDate?<span><span className={styles.mobileLabel}>{t('入库 ')}</span>{historyDate(item.intakeDate,false,locale)}</span>:null}{item.pickupDate?<small><span className={styles.mobileLabel}>{t('拿走 ')}</span>{historyDate(item.pickupDate,false,locale)}</small>:null}</div>
       <div className={styles.money}>{item.priceCents!==null?<span><span className={styles.mobileLabel}>{t('标价 ')}</span>{historyMoney(item.priceCents,locale)}</span>:null}{item.salePriceCents!==null?<small><span className={styles.mobileLabel}>{t('成交 ')}</span>{historyMoney(item.salePriceCents,locale)}</small>:null}</div>
       <div className={styles.states}><span className={`status-pill status-pill--${view==='available'?'success':view==='sold'?'info':'progress'} ${styles.status}`}>{item.previews?.includes('status')?preview('status',item.status):t(item.status)}</span>{item.reviewCount>0?<span className={styles.review}>{t('待核对 · ')}{item.reviewCount}</span>:null}</div>
      </Link>;
     }}/>
    </div>
    {!total?<div className="module-empty"><Archive size={28}/><strong>{hasFilters?t('没有符合条件的商品'):view==='available'?t('暂无在售商品'):view==='sold'?t('暂无已售记录'):t('暂无其他状态商品')}</strong>{hasFilters?<button type="button" className="button button--secondary" onClick={clear}>{t('清除筛选')}</button>:null}</div>:null}
   </>}
   <ListPagination start={startIndex} shown={startIndex+items.length} total={total} hasMore={hasMore} onLoadMore={loadMore} loading={pending} error={Boolean(error)} resetKey={resetKey} label={t('整机商品加载')}/>
  </section>
 </main>;
}
