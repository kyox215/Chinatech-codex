"use client";
import {AccountBrand} from '@/components/account/account-heading';
import styles from './stores.module.css';
import {useEffect,useState} from 'react';
import {useLanguage} from '@/components/language-provider';
import {NavigationLink} from '@/components/navigation-link';
import {ContentProgress,useActivityFeedback} from '@/components/operation-feedback';
import {forgetInvitationHash,persistInvitation} from '@/lib/store-invitation-client';
export function JoinStore(){
 const {t,systemText}=useLanguage(),[reading,setReading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useActivityFeedback(reading);
 useEffect(()=>{
  const controller=new AbortController(),hash=window.location.hash,token=new URLSearchParams(hash.slice(1)).get('invite');
  (async()=>{try{if(token){await persistInvitation(token,controller.signal);if(!controller.signal.aborted)forgetInvitationHash(hash);}}catch{if(!controller.signal.aborted)setError('邀请暂未保存，请保留原邀请链接并重试。');}finally{if(!controller.signal.aborted)setReading(false);}})();
  return()=>controller.abort();
 },[retry]);
 return <main className={styles.page}><AccountBrand/><ContentProgress/><h1>{t('加入已有门店')}</h1><p>{t('登录或注册后核对店名并申请，审核通过后进入门店。')}</p>{error?<div><p role="alert">{systemText(error)}</p><button className="button button--secondary" disabled={reading} aria-busy={reading} onClick={()=>{setError('');setReading(true);setRetry(v=>v+1);}}>{t('重试')}</button></div>:null}{!reading&&!error?<div className={styles.actions}><NavigationLink className="button button--primary" href="/account/stores">{t('继续')}</NavigationLink><NavigationLink className="button button--secondary" href="/register">{t('注册')}</NavigationLink></div>:null}</main>;
}
