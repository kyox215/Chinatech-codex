"use client";
import{replaceBackendDocumentUrl}from"@/lib/backend/client";
import{useEffect,useMemo}from'react';
import{useSearchParams}from'next/navigation';
import{useLanguage}from'@/components/language-provider';
import{SelectControl}from'@/components/select-control';
import{retailSearchLabels}from'@/lib/i18n/retail-display';
import{retailCategories,retailStatuses,type RetailUnit}from'@/lib/retail';
import type{RetailHistoryRecord}from'@/lib/retail-history';
import{buildRetailListIndex,defaultRetailListSort,queryRetailList,resolveRetailListSort,retailViewFromParams,type RetailView}from'@/lib/retail-list-model';
import{useRetail}from'./retail-provider';
import{RetailRecordScanner}from'./retail-record-scanner';
import{RetailListBody}from'./retail-list-body';
export function RetailHistoryList({records,units,ready,error}:{records:RetailHistoryRecord[];units:RetailUnit[];ready:boolean;error:string}){
  const { t } = useLanguage();
  const { dispatch, returnTo, returnScroll } = useRetail();
  const params = useSearchParams();
  const view = retailViewFromParams(params);
  const query = params.get("q") || "";
  const rawCondition = params.get("condition");
  const condition = rawCondition === "新机" || rawCondition === "翻新机" ? rawCondition : "all";
  const rawCategory = params.get("category") || "all";
  const category = params.get("source") === "units" && Object.hasOwn(retailCategories, rawCategory) ? retailCategories[rawCategory as keyof typeof retailCategories] : rawCategory;
  const review = params.get("review") === "pending";
  const defaultSort = defaultRetailListSort(view);
  const sort = resolveRetailListSort(view, params.get("sort"));
  const rawStatus = view === "other" ? params.get("status") || "all" : "all";
  const status = params.get("source") === "units" && Object.hasOwn(retailStatuses, rawStatus) ? retailStatuses[rawStatus as keyof typeof retailStatuses].label : rawStatus === "processing" ? "all" : rawStatus;
  const requestedPage = Number(params.get("page") || "1");
  // Project only list facts once per authorized dataset, not on every keystroke.
  const index = useMemo(() => buildRetailListIndex(units, records).map(item => ({ ...item, search: `${item.search} ${retailSearchLabels(item)}`.normalize("NFKC").toLowerCase() })), [units, records]);
  const result = useMemo(() => queryRetailList(index, {view, condition, query, category, review, sort, status, page:requestedPage}),
    [index, view, condition, query, category, review, sort, status, requestedPage]);
  const listParams = new URLSearchParams(params.toString());
  listParams.delete("source");
  if (category !== "all") listParams.set("category", category);
  if (status !== "all") listParams.set("status", status);
  if(view === "available") listParams.delete("view"); else listParams.set("view",view);
  if(view !== "other") listParams.delete("status");
  if(result.page > 1) listParams.set("page",String(result.page)); else listParams.delete("page");
  const listUrl = `/app/retail${listParams.size ? `?${listParams}` : ""}`;
  useEffect(() => { if (listUrl === returnTo) window.scrollTo({ top: returnScroll, behavior: "instant" }); }, [listUrl, returnTo, returnScroll]);
  function update(key:string,value:string) {
    const next = new URLSearchParams(listParams);
    if(!value || value === "all" || key === "sort" && value === defaultSort) next.delete(key); else next.set(key,value);
    if(key !== "page") next.delete("page");
    replaceBackendDocumentUrl(`/app/retail${next.size ? `?${next}` : ""}`);
  }
  const viewHref = (value:RetailView) => `/app/retail${value === "available" ? "" : `?view=${value}`}`;
  const clear = () => replaceBackendDocumentUrl(viewHref(view));
  const remember = () => dispatch({type:"remember",url:listUrl,scroll:window.scrollY});
  const unitsById=useMemo(()=>new Map(units.map(unit=>[unit.id,unit])),[units]);
  const summary=result.items.map(({search,...row})=>{
   void search;const unit=row.source==='unit'?unitsById.get(row.id):undefined;
   const specificationFacts=unit&&(unit.ramGb!==null||unit.bodyStorage||unit.disks.length||unit.edition)?{category:unit.category,ramGb:unit.ramGb,bodyStorage:unit.bodyStorage,disks:unit.disks,edition:unit.edition}:null;
   return{...row,specificationFacts};
  });
  return <RetailListBody query={{view,q:query,condition,category,status,review,sort}} items={summary} total={result.total} viewCounts={result.viewCounts} conditionCounts={result.conditionCounts} ready={ready} error={error} update={patch=>{for(const[key,value]of Object.entries(patch))update(key,key==='review'?(value?'pending':'all'):String(value));}} clear={clear} categoryFilter={<label className="module-select"><SelectControl aria-label={t('商品类型筛选')} value={category} onChange={event=>update('category',event.target.value)}><option value="all">{t('全部类型')}</option>{result.categories.map(value=><option key={value} value={value}>{t(value)}</option>)}</SelectControl></label>} statusFilter={<label className="module-select"><SelectControl aria-label={t('其他状态筛选')} value={status} onChange={event=>update('status',event.target.value)}><option value="all">{t('全部其他状态')}</option>{result.statuses.map(value=><option key={value} value={value}>{t(value)}</option>)}</SelectControl></label>} renderScanner={close=><RetailRecordScanner units={units} records={records} onClose={close} onNavigate={remember}/>} listUrl={listUrl} onRemember={remember} hasMore={result.page<result.pageCount} loadMore={()=>update('page',String(result.page+1))} resetKey={[view,condition,query,category,review,sort,status].join('|')}/>;
}
