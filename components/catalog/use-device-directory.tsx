"use client";
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createDeviceDirectoryClient, type DirectoryQuery, type DirectoryRead } from '@/lib/device-directory-client';
import { deviceDirectoryStorage } from '@/lib/device-directory-storage';
import { useActivityFeedback } from '@/components/operation-feedback';
const directory=createDeviceDirectoryClient({fetch:(...args)=>fetch(...args),store:deviceDirectoryStorage});
const empty:DirectoryRead=Object.freeze({data:null,loading:false,error:'',ready:false});
let subscribers=0, beforeUnload=false;
let stopFlightObservation:(()=>void)|undefined;
function resume(){if(document.visibilityState==='visible'&&navigator.onLine)void directory.ensure();}
function updated(){void directory.ensure(true);}
function leaving(){directory.cancel();}
function observeFlight(){
  const busy=subscribers>0 && directory.isFetching();
  if(busy && !beforeUnload){window.addEventListener('beforeunload',leaving);beforeUnload=true;}
  else if(!busy && beforeUnload){window.removeEventListener('beforeunload',leaving);beforeUnload=false;}
}
const noSubscription=()=>()=>{};
function subscribe(listener:()=>void){
  const stop=directory.subscribe(listener);
  if(subscribers++===0){
    stopFlightObservation=directory.subscribe(observeFlight);
    window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('ct:catalog-updated',updated);
    window.addEventListener('pagehide',leaving);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
  }
  observeFlight();
  return()=>{stop();if(--subscribers===0){
    stopFlightObservation?.();stopFlightObservation=undefined;
    window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('ct:catalog-updated',updated);
    window.removeEventListener('pagehide',leaving);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);
    directory.cancel();observeFlight();
  }};
}
export function useDeviceDirectoryIndex(query:DirectoryQuery,enabled=true){
  const key=JSON.stringify(query);const read=useCallback(()=>enabled?directory.read(JSON.parse(key)):empty,[key,enabled]);
  const value=useSyncExternalStore(enabled?subscribe:noSubscription,read,()=>empty);
  useEffect(()=>{if(enabled)void directory.ensure();},[enabled]);
  useActivityFeedback(enabled&&value.loading,{kind:'read',scope:'public-device-directory-v1'});
  return {...value,retry:()=>{if(enabled)void directory.ensure(true);}};
}
export function DeviceDirectoryPreload({enabled=true}:{enabled?:boolean}){
  useEffect(()=>{if(!enabled)return;const stop=subscribe(()=>{});void directory.ensure();return stop;},[enabled]);
  return null;
}
