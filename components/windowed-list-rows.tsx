"use client";
import { Fragment, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefCallback, type RefObject } from "react";
function scrollPosition(root?:RefObject<HTMLElement|null>){return root?.current?.scrollTop??window.scrollY;}
// Only numeric movement belongs to this coordinator. Several visible domain
// groups can share one scroller; a sibling's compensation is not user input.
const compensatedScrolls=new WeakMap<HTMLElement|Window,number>();
const scrollRounding=new WeakMap<HTMLElement|Window,{position:number;remainder:number}>();
function compensatedScroll(root?:RefObject<HTMLElement|null>){return compensatedScrolls.get(root?.current??window)??0;}
function moveScroll(root:RefObject<HTMLElement|null>|undefined,top:number,resetRounding=false){
 const container=root?.current,target=container??window,before=scrollPosition(root),previous=scrollRounding.get(target);
 // Browsers may truncate fractional scrolls. Carry only that subpixel error,
 // never a prior user's movement or a clamped request at the scroll boundary.
 const remainder=!resetRounding&&previous?.position===before?previous.remainder:0,requested=before+top+remainder;
 target.scrollBy({top:Math.round(requested)-before,behavior:"instant"});
 const after=scrollPosition(root),maximum=Math.max(0,container?container.scrollHeight-container.clientHeight:(document.scrollingElement?.scrollHeight??0)-window.innerHeight),error=requested-after;
 scrollRounding.set(target,{position:after,remainder:requested>=0&&requested<=maximum&&Math.abs(error)<=.5?error:0});
 compensatedScrolls.set(target,compensatedScroll(root)+after-before);
}
type RowProps={ref:RefCallback<HTMLElement>;"data-window-key":string;"data-window-index":number};
// Nested record windows own their keyboard navigation. Ancestors pin the
// enclosing outer row while focus is anywhere inside that row's child window.
function ownedWindowRow(target:EventTarget|null,list:HTMLElement|null):HTMLElement|null{
 if(!(target instanceof HTMLElement)||!list)return null;
 let row=target.closest<HTMLElement>('[data-window-key]');
 while(row&&list.contains(row)){if(row.closest('[data-windowed-list]')===list)return row;row=row.parentElement?.closest<HTMLElement>('[data-window-key]')??null;}return null;
}
function windowRows(list:HTMLElement){return [...list.querySelectorAll<HTMLElement>('[data-window-key]')].filter(row=>row.closest('[data-windowed-list]')===list);}
function rowControls(row:HTMLElement) {
 const selector='summary,a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
 const controls=[...row.querySelectorAll<HTMLElement>(selector)];if(row.matches(selector))controls.unshift(row);
 return controls.filter(control=>control.getClientRects().length>0&&getComputedStyle(control).visibility!=="hidden");
}
function MeasuredRow<T>({item,index,rowKey,onHeight,render}:{item:T;index:number;rowKey:string;onHeight:(index:number,height:number)=>void;render:(item:T,props:RowProps)=>ReactNode}) {
  const ref=useCallback((node:HTMLElement|null)=>{
    if(!node)return;
    const measure=()=>onHeight(index,node.getBoundingClientRect().height);measure();
    const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[index,onHeight]);
  return render(item,{ref,"data-window-key":rowKey,"data-window-index":index});
}
/** Only rendering is windowed. Counts/search remain on the complete server set.
 * Numeric measured heights contain no business rows and remain outside the
 * ten-batch summary cache. Focused rows survive cache movement until blur. */
export function WindowedListRows<T>({items,startIndex=0,total,thresholdTotal=total,extent,estimate=88,rowKey,render,onAnchor,onSeek,onLoadPrevious,pending=false,version="",initialAnchor,initialOffset=0,active=true,scrollRoot,anchorSelector}:{items:T[];startIndex?:number;total:number;thresholdTotal?:number;extent?:number;estimate?:number;rowKey:(item:T)=>string;render:(item:T,props:RowProps)=>ReactNode;onAnchor?:(item:T)=>void;onSeek?:(index:number)=>void;onLoadPrevious?:()=>void;pending?:boolean;version?:string;initialAnchor?:string;initialOffset?:number;active?:boolean;scrollRoot?:RefObject<HTMLElement|null>;anchorSelector?:string}) {
  const anchorElement=useCallback((node:HTMLElement)=>anchorSelector?node.querySelector<HTMLElement>(anchorSelector)??node:node,[anchorSelector]);
  const root=useRef<HTMLDivElement>(null),anchor=useRef<{key:string;top:number;scrollPosition:number;compensatedScroll:number}|null>(null),frame=useRef(0);
  const [measurements,setMeasurements]=useState<{version:string;heights:ReadonlyMap<number,number>}>(()=>({version,heights:new Map()}));
  if(measurements.version!==version)setMeasurements({version,heights:new Map()});
  const heights=measurements.heights;
  const [viewport,setViewport]=useState({top:0,height:1000,ready:false});
  const [restorePending,setRestorePending]=useState(Boolean(initialAnchor));
  const [pinned,setPinned]=useState<{item:T;index:number;key:string}|null>(null);
  const [forced,setForced]=useState<number|null>(null);
  const forcedReverse=useRef(false);
  const seekFlight=useRef<number|null>(null);
  const anchorChanged=useEffectEvent((item:T)=>onAnchor?.(item)),seek=useEffectEvent((index:number)=>onSeek?.(index)),loadPrevious=useEffectEvent(()=>onLoadPrevious?.());
  const measureViewport=useEffectEvent(()=>{
    const node=root.current;if(!node)return;
    const rect=node.getBoundingClientRect(),container=scrollRoot?.current,boundary=container?.getBoundingClientRect(),top=boundary?boundary.top+container!.clientTop:0,height=container?.clientHeight??window.innerHeight;
    setViewport(previous=>Math.abs(previous.top+rect.top-top)<.5&&previous.height===height&&previous.ready?previous:{top:top-rect.top,height,ready:true});
    const visible=windowRows(node).find(row=>{const rect=row.getBoundingClientRect();return rect.bottom>top&&rect.top<top+height;});
    if(visible&&!restorePending){anchor.current={key:visible.dataset.windowKey!,top:anchorElement(visible).getBoundingClientRect().top,scrollPosition:scrollPosition(scrollRoot),compensatedScroll:compensatedScroll(scrollRoot)};const item=items.find(item=>rowKey(item)===visible.dataset.windowKey);if(item)anchorChanged(item);}
  });
  useEffect(()=>{const update=()=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>measureViewport());};update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update,{passive:true});const container=scrollRoot?.current;container?.addEventListener("scroll",update,{passive:true});return()=>{container?.removeEventListener("scroll",update);cancelAnimationFrame(frame.current);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};},[scrollRoot]);
  const onHeight=useCallback((index:number,height:number)=>{if(height<=0)return;setMeasurements(previous=>{if(Math.abs((previous.heights.get(index)??estimate)-height)<.5)return previous;const next=new Map(previous.heights);next.set(index,height);return {version,heights:next};});},[estimate,version]);
  const offset=useMemo(()=>{
    const entries=[...heights].sort((a,b)=>a[0]-b[0]),sum=[0];for(const [,height]of entries)sum.push(sum.at(-1)!+height-estimate);
    return(index:number)=>{let a=0,b=entries.length;while(a<b){const mid=(a+b)>>>1;if(entries[mid][0]<index)a=mid+1;else b=mid;}return index*estimate+sum[a];};
  },[heights,estimate]);
  const end=startIndex+items.length,windowed=thresholdTotal>200||startIndex>0,retainedEnd=Math.max(end,Math.min(total,extent??end),pinned?pinned.index+1:0);
  const rows=items.map((item,i)=>({item,index:startIndex+i,key:rowKey(item)}));
  if(pinned&&!rows.some(row=>row.key===pinned.key))rows.push(pinned);
  rows.sort((a,b)=>a.index-b.index);
  const displayed=rows.filter(row=>!active||restorePending||!viewport.ready||!windowed||row.key===pinned?.key||row.index===forced||offset(row.index+1)>=viewport.top-viewport.height&&offset(row.index)<=viewport.top+2*viewport.height);
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    const saved=anchor.current;
    if(saved&&!restorePending){const target=windowRows(node).find(row=>row.dataset.windowKey===saved.key);if(target){
      // A scroll event updates the viewport on the next animation frame. A
      // synchronous row commit may arrive first: preserve that real movement
      // and compensate only for the layout change since this anchor sample.
      const element=anchorElement(target),difference=element.getBoundingClientRect().top-saved.top+scrollPosition(scrollRoot)-saved.scrollPosition-(compensatedScroll(scrollRoot)-saved.compensatedScroll);
      if(Math.abs(difference)>=1/64)moveScroll(scrollRoot,difference);
      anchor.current={key:saved.key,top:element.getBoundingClientRect().top,scrollPosition:scrollPosition(scrollRoot),compensatedScroll:compensatedScroll(scrollRoot)};
    }}
    if(forced!==null){const target=windowRows(node).find(row=>Number(row.dataset.windowIndex)===forced);if(target){
      const controls=rowControls(target),control=(forcedReverse.current?controls.at(-1):controls[0])??anchorElement(target);control.focus();
      // Native focus scrolling can leave a control's border box clipped at a
      // scroll edge. A row we explicitly mounted must expose its real control.
      const container=scrollRoot?.current,bounds=container?.getBoundingClientRect(),top=bounds?bounds.top+container!.clientTop:0,bottom=top+(container?.clientHeight??window.innerHeight),rect=control.getBoundingClientRect();
      if(rect.top<top||rect.bottom>bottom)control.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
      queueMicrotask(()=>setForced(current=>current===forced?null:current));
    }}
  },[heights,items,startIndex,forced,initialAnchor,initialOffset,active,restorePending,scrollRoot,anchorElement]);
  useEffect(()=>{
    if(!active||!restorePending||!initialAnchor||!items.some(item=>rowKey(item)===initialAnchor))return;
    let stopped=false,animation=0;
    const stop=()=>{stopped=true;cancelAnimationFrame(animation);for(const event of ["wheel","touchstart","pointerdown","keydown"])window.removeEventListener(event,cancel);};
    const cancel=()=>{stop();setRestorePending(false);};
    const restore=()=>{
      if(stopped)return;
      const target=(root.current?windowRows(root.current):[]).find(row=>row.dataset.windowKey===initialAnchor);
      if(target){const element=anchorElement(target),difference=element.getBoundingClientRect().top-initialOffset;moveScroll(scrollRoot,difference,true);element.focus({preventScroll:true});anchor.current={key:initialAnchor,top:element.getBoundingClientRect().top,scrollPosition:scrollPosition(scrollRoot),compensatedScroll:compensatedScroll(scrollRoot)};}
      stop();setRestorePending(false);measureViewport();
    };
    for(const event of ["wheel","touchstart","pointerdown","keydown"])window.addEventListener(event,cancel,{passive:true});
    // Next restores SPA scroll after child layout effects; wait for that commit
    // before restoring the authorized row, and cancel if the user takes over.
    animation=requestAnimationFrame(()=>{animation=requestAnimationFrame(restore);});
    return stop;
  },[active,restorePending,initialAnchor,initialOffset,version,items,rowKey,scrollRoot,anchorElement]);
  useEffect(()=>{
    if(!active||restorePending||(!onSeek&&!onLoadPrevious)||pending||!items.length||!viewport.ready)return;
    // Multiple domain groups share the document viewport. A group entirely
    // above/below it must not seek to its first/last row while another is read.
    if(viewport.top+viewport.height<=0||viewport.top>=offset(retainedEnd))return;
    // A restored row may sit halfway down the viewport. Its preceding visible
    // area needs authorized summaries as well as the numeric placeholder.
    // Merge the previous batch so this never replaces the visible target.
    if(onLoadPrevious&&startIndex>0&&viewport.top<offset(startIndex)&&viewport.top+viewport.height>offset(startIndex)){loadPrevious();return;}
    if(!onSeek)return;
    const before=viewport.top+viewport.height<offset(startIndex),after=viewport.top>offset(end);
    if(!before&&!after){seekFlight.current=null;return;}
    let left=0,right=total;while(left<right){const mid=(left+right)>>>1;if(offset(mid+1)<=viewport.top)left=mid+1;else right=mid;}
    const approximate=Math.max(0,Math.min(total-1,left));
    if(seekFlight.current===approximate)return;
    seekFlight.current=approximate;seek(approximate);
  },[viewport,startIndex,end,total,retainedEnd,estimate,offset,pending,onSeek,onLoadPrevious,items.length,active,restorePending]);
  const previous=(displayed.at(-1)?.index??-1)+1;
  return <div ref={root} data-windowed-list data-window-cache={items.length} data-window-start={startIndex} data-window-end={end} data-window-total={total} style={{overflowAnchor:"none"}} onFocusCapture={event=>{
    const row=ownedWindowRow(event.target,root.current);if(!row)return;const item=items.find(item=>rowKey(item)===row.dataset.windowKey);if(item)setPinned({item,index:Number(row.dataset.windowIndex),key:row.dataset.windowKey!});
  }} onBlurCapture={event=>{if(ownedWindowRow(event.relatedTarget,root.current)?.dataset.windowKey!==pinned?.key)setPinned(null);}} onKeyDownCapture={event=>{
    if(event.key!=="Tab")return;const target=event.target as HTMLElement;
    // An inner list owns its middle rows. At its actual complete boundary the
    // ancestor must still bridge to an unrendered logical outer row.
    for(let nested=target.closest<HTMLElement>('[data-windowed-list]');nested&&nested!==root.current;nested=nested.parentElement?.closest<HTMLElement>('[data-windowed-list]')??null){
      const nestedRow=ownedWindowRow(target,nested),boundary=event.shiftKey?0:Number(nested.dataset.windowTotal)-1;
      if(!nestedRow||Number(nestedRow.dataset.windowIndex)!==boundary)return;
    }
    const row=ownedWindowRow(target,root.current);if(!row)return;
    const controls=rowControls(row);
    if(event.target!==(event.shiftKey?controls[0]:controls.at(-1)))return;
    const next=Number(row.dataset.windowIndex)+(event.shiftKey?-1:1);if(next<startIndex||next>=end)return;
    if(!displayed.some(row=>row.index===next)){event.preventDefault();forcedReverse.current=event.shiftKey;setForced(next);}
  }}>
    {displayed.map((row,i)=>{const gap=Math.max(0,offset(row.index)-offset(i?displayed[i-1].index+1:0));return <Fragment key={row.key}>{gap>0?<div aria-hidden="true" style={{height:gap}}/>:null}<MeasuredRow item={row.item} index={row.index} rowKey={row.key} onHeight={onHeight} render={render}/></Fragment>;})}
    {retainedEnd>previous?<div aria-hidden="true" style={{height:Math.max(0,offset(retainedEnd)-offset(previous))}}/>:null}
  </div>;
}
