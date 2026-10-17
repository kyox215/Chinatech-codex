"use client";
import {AccountBrand} from "@/components/account/account-heading";
import styles from "./stores.module.css";
import {useEffect} from 'react';
import {useLanguage} from '@/components/language-provider';
import {NavigationLink} from '@/components/navigation-link';
export function JoinStore(){const {t}=useLanguage();useEffect(()=>{const token=new URLSearchParams(window.location.hash.slice(1)).get('invite');if(token&&/^[A-Za-z0-9_-]{43}$/.test(token)){try{sessionStorage.setItem('ct-pending-invite',token);history.replaceState(null,'','/join');}catch{/* The user can copy the token manually. */}}},[]);return <main className={styles.page}><AccountBrand/><h1>{t('加入已有门店')}</h1><p>{t('登录或注册后核对店名并申请，审核通过后进入门店。')}</p><NavigationLink className="button button--primary" href="/account/stores">{t('继续')}</NavigationLink><NavigationLink className="button button--secondary" href="/register">{t('注册')}</NavigationLink></main>;}
