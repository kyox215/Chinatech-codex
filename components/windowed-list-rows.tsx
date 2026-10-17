"use client";
import { Fragment, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefCallback, type RefObject } from "react";
type RowProps={ref:RefCallback<HTMLElement>;"data-window-key":string;"data-window-index":number};
function rowControls(row:HTMLElement) {
 const selector='a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
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
export function WindowedListRows<T>({items,startIndex=0,total,estimate=88,rowKey,render,onAnchor,onSeek,pending=false,version="",initialAnchor,initialOffset=0,active=true,scrollRoot,anchorSelector}:{items:T[];startIndex?:number;total:number;estimate?:number;rowKey:(item:T)=>string;render:(item:T,props:RowProps)=>ReactNode;onAnchor?:(item:T)=>void;onSeek?:(index:number)=>void;pending?:boolean;version?:string;initialAnchor?:string;initialOffset?:number;active?:boolean;scrollRoot?:RefObject<HTMLElement|null>;anchorSelector?:string}) {
  const anchorElement=useCallback((node:HTMLElement)=>anchorSelector?node.querySelector<HTMLElement>(anchorSelector)??node:node,[anchorSelector]);
  const root=useRef<HTMLDivElement>(null),anchor=useRef<{key:string;top:number}|null>(null),frame=useRef(0);
  const [measurements,setMeasurements]=useState<{version:string;heights:ReadonlyMap<number,number>}>(()=>({version,heights:new Map()}));
  if(measurements.version!==version)setMeasurements({version,heights:new Map()});
  const heights=measurements.heights;
  const [viewport,setViewport]=useState({top:0,height:1000,ready:false});
  const [restorePending,setRestorePending]=useState(Boolean(initialAnchor));
  const [pinned,setPinned]=useState<{item:T;index:number;key:string}|null>(null);
  const [forced,setForced]=useState<number|null>(null);
  const forcedReverse=useRef(false);
  const seekFlight=useRef<number|null>(null);
  const anchorChanged=useEffectEvent((item:T)=>onAnchor?.(item)),seek=useEffectEvent((index:number)=>onSeek?.(index));
  const measureViewport=useEffectEvent(()=>{
    const node=root.current;if(!node)return;
    const rect=node.getBoundingClientRect(),container=scrollRoot?.current,boundary=container?.getBoundingClientRect(),top=boundary?boundary.top+container!.clientTop:0,height=container?.clientHeight??window.innerHeight;
    setViewport(previous=>Math.abs(previous.top+rect.top-top)<.5&&previous.height===height&&previous.ready?previous:{top:top-rect.top,height,ready:true});
    const visible=[...node.querySelectorAll<HTMLElement>('[data-window-key]')].find(row=>{const rect=row.getBoundingClientRect();return rect.bottom>top&&rect.top<top+height;});
    if(visible&&!restorePending){anchor.current={key:visible.dataset.windowKey!,top:anchorElement(visible).getBoundingClientRect().top};const item=items.find(item=>rowKey(item)===visible.dataset.windowKey);if(item)anchorChanged(item);}
  });
  useEffect(()=>{const update=()=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>measureViewport());};update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update,{passive:true});const container=scrollRoot?.current;container?.addEventListener("scroll",update,{passive:true});return()=>{container?.removeEventListener("scroll",update);cancelAnimationFrame(frame.current);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};},[scrollRoot]);
  const onHeight=useCallback((index:number,height:number)=>{if(height<=0)return;setMeasurements(previous=>{if(Math.abs((previous.heights.get(index)??estimate)-height)<.5)return previous;const next=new Map(previous.heights);next.set(index,height);return {version,heights:next};});},[estimate,version]);
  const offset=useMemo(()=>{
    const entries=[...heights].sort((a,b)=>a[0]-b[0]),sum=[0];for(const [,height]of entries)sum.push(sum.at(-1)!+height-estimate);
    return(index:number)=>{let a=0,b=entries.length;while(a<b){const mid=(a+b)>>>1;if(entries[mid][0]<index)a=mid+1;else b=mid;}return index*estimate+sum[a];};
  },[heights,estimate]);
  const end=startIndex+items.length,windowed=total>200||startIndex>0;
  const rows=items.map((item,i)=>({item,index:startIndex+i,key:rowKey(item)}));
  if(pinned&&!rows.some(row=>row.key===pinned.key))rows.push(pinned);
  rows.sort((a,b)=>a.index-b.index);
  const displayed=rows.filter(row=>!active||restorePending||!viewport.ready||!windowed||row.key===pinned?.key||row.index===forced||offset(row.index+1)>=viewport.top-viewport.height&&offset(row.index)<=viewport.top+2*viewport.height);
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    const saved=anchor.current;
    if(saved&&!restorePending){const target=[...node.querySelectorAll<HTMLElement>('[data-window-key]')].find(row=>row.dataset.windowKey===saved.key);if(target){const difference=anchorElement(target).getBoundingClientRect().top-saved.top;if(Math.abs(difference)>.5)(scrollRoot?.current??window).scrollBy({top:difference,behavior:"instant"});}}
    if(forced!==null){const target=node.querySelector<HTMLElement>(`[data-window-index="${forced}"]`);if(target){const controls=rowControls(target);((forcedReverse.current?controls.at(-1):controls[0])??anchorElement(target)).focus();queueMicrotask(()=>setForced(current=>current===forced?null:current));}}
  },[heights,items,startIndex,forced,initialAnchor,initialOffset,active,restorePending,scrollRoot,anchorElement]);
  useEffect(()=>{
    if(!active||!restorePending||!initialAnchor||!items.some(item=>rowKey(item)===initialAnchor))return;
    let stopped=false,animation=0;
    const stop=()=>{stopped=true;cancelAnimationFrame(animation);for(const event of ["wheel","touchstart","pointerdown","keydown"])window.removeEventListener(event,cancel);};
    const cancel=()=>{stop();setRestorePending(false);};
    const restore=()=>{
      if(stopped)return;
      const target=[...(root.current?.querySelectorAll<HTMLElement>('[data-window-key]')??[])].find(row=>row.dataset.windowKey===initialAnchor);
      if(target){const difference=anchorElement(target).getBoundingClientRect().top-initialOffset;(scrollRoot?.current??window).scrollBy({top:difference,behavior:"instant"});anchorElement(target).focus({preventScroll:true});anchor.current={key:initialAnchor,top:initialOffset};}
      stop();setRestorePending(false);measureViewport();
    };
    for(const event of ["wheel","touchstart","pointerdown","keydown"])window.addEventListener(event,cancel,{passive:true});
    // Next restores SPA scroll after child layout effects; wait for that commit
    // before restoring the authorized row, and cancel if the user takes over.
    animation=requestAnimationFrame(()=>{animation=requestAnimationFrame(restore);});
    return stop;
  },[active,restorePending,initialAnchor,initialOffset,version,items,rowKey,scrollRoot,anchorElement]);
  useEffect(()=>{
    if(!active||restorePending||!onSeek||pending||!items.length)return;
    const before=viewport.top+viewport.height<offset(startIndex),after=viewport.top>offset(end);
    if(!before&&!after){seekFlight.current=null;return;}
    let left=0,right=total;while(left<right){const mid=(left+right)>>>1;if(offset(mid+1)<=viewport.top)left=mid+1;else right=mid;}
    const approximate=Math.max(0,Math.min(total-1,left));
    if(seekFlight.current===approximate)return;
    seekFlight.current=approximate;seek(approximate);
  },[viewport,startIndex,end,total,estimate,offset,pending,onSeek,items.length,active,restorePending]);
  const previous=(displayed.at(-1)?.index??-1)+1;
  return <div ref={root} data-windowed-list data-window-cache={items.length} style={{overflowAnchor:"none"}} onFocusCapture={event=>{
    const row=(event.target as HTMLElement).closest<HTMLElement>('[data-window-key]');if(!row)return;const item=items.find(item=>rowKey(item)===row.dataset.windowKey);if(item)setPinned({item,index:Number(row.dataset.windowIndex),key:row.dataset.windowKey!});
  }} onBlurCapture={event=>{if(!(event.relatedTarget instanceof HTMLElement)||event.relatedTarget.closest('[data-window-key]')?.getAttribute('data-window-key')!==pinned?.key)setPinned(null);}} onKeyDownCapture={event=>{
    if(event.key!=="Tab")return;const row=(event.target as HTMLElement).closest<HTMLElement>('[data-window-index]');if(!row)return;
    const controls=rowControls(row);
    if(event.target!==(event.shiftKey?controls[0]:controls.at(-1)))return;
    const next=Number(row.dataset.windowIndex)+(event.shiftKey?-1:1);if(next<startIndex||next>=end)return;
    if(!displayed.some(row=>row.index===next)){event.preventDefault();forcedReverse.current=event.shiftKey;setForced(next);}
  }}>
    {displayed.map((row,i)=>{const gap=Math.max(0,offset(row.index)-offset(i?displayed[i-1].index+1:0));return <Fragment key={row.key}>{gap>0?<div aria-hidden="true" style={{height:gap}}/>:null}<MeasuredRow item={row.item} index={row.index} rowKey={row.key} onHeight={onHeight} render={render}/></Fragment>;})}
    {Math.max(end,pinned?pinned.index+1:0)>previous?<div aria-hidden="true" style={{height:Math.max(0,offset(Math.max(end,pinned?pinned.index+1:0))-offset(previous))}}/>:null}
  </div>;
}
