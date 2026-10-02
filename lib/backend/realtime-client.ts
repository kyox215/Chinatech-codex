"use client";

// A notification is only an invalidation hint. State and permissions always
// come from the authenticated HTTP read; reconnect also performs that read.
export function startRealtimeUpdates(invalidate:()=>void) {
  let source:EventSource|null=null;
  let stopped=false;let connected=false;let failures=0;
  let retry:ReturnType<typeof setTimeout>|undefined;
  let batch:ReturnType<typeof setTimeout>|undefined;
  const available=()=>!stopped && document.visibilityState!=="hidden" && navigator.onLine;
  const changed=()=>{
    if(!available() || batch)return;
    batch=setTimeout(()=>{batch=undefined;if(available())invalidate();},80);
  };
  const close=()=>{connected=false;source?.close();source=null;};
  const connect=()=>{
    retry=undefined;
    if(!available() || source || typeof EventSource==="undefined")return;
    const current=new EventSource("/api/backend/events");source=current;
    const live=()=>source===current && available();
    current.addEventListener("ready",()=>{if(live()){connected=true;failures=0;changed();}});
    current.addEventListener("invalidate",()=>{if(live())changed();});
    current.addEventListener("access-changed",()=>{if(live()){changed();current.onerror?.(new Event("error"));}});
    current.onerror=()=>{
      if(source!==current)return;
      close();
      if(available()){
        const delay=Math.min(30000,1000*2**Math.min(failures++,5))+Math.floor(Math.random()*500);
        retry=setTimeout(connect,delay);
      }
    };
  };
  const reconcile=()=>{
    if(!available()){close();clearTimeout(retry);retry=undefined;clearTimeout(batch);batch=undefined;}
    else if(!source && !retry)connect();
  };
  reconcile();
  return {
    isConnected:()=>connected,
    reconcile,
    stop:()=>{stopped=true;close();clearTimeout(retry);clearTimeout(batch);},
  };
}
