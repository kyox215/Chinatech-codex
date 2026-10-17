import type {NextRequest} from 'next/server';
import {storeHttp,requestStore} from '@/lib/server/store-http';
import {storeTransaction,storeUsage} from '@/lib/server/stores';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return storeHttp(request,false,[],identity=>{const id=requestStore(request);return storeTransaction(identity,id,false,tx=>storeUsage(tx,id));});}
