import type {NextRequest} from 'next/server';
import {storeHttp} from '@/lib/server/store-http';
import {createStore,myStores} from '@/lib/server/stores';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return storeHttp(request,false,[],async identity=>({...await myStores(identity),accountId:identity.userId}));}
export function POST(request:NextRequest){return storeHttp(request,true,['requestId','name'],(identity,body)=>createStore(identity,body.requestId,body.name));}
