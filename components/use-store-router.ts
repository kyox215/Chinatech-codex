"use client";
import {useMemo} from 'react';
import {useRouter} from 'next/navigation';
import {useBackendState} from '@/components/backend-snapshot';
import {scopedStoreUrl} from '@/lib/store-scope';
/** Keep imperative post-save navigation in the same document's tenant. */
export function useStoreRouter(){const router=useRouter(),{snapshot}=useBackendState();return useMemo(()=>({...router,push:(href:string,options?:Parameters<typeof router.push>[1])=>router.push(scopedStoreUrl(href,snapshot?.storeId),options),replace:(href:string,options?:Parameters<typeof router.replace>[1])=>router.replace(scopedStoreUrl(href,snapshot?.storeId),options)}),[router,snapshot?.storeId]);}
