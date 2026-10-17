import type {NextRequest} from 'next/server';
import {storeHttp,requestStore} from '@/lib/server/store-http';
import {listAdmission,reviewApplication} from '@/lib/server/stores';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return storeHttp(request,false,[],identity=>listAdmission(identity,requestStore(request)));}
export function POST(request:NextRequest){return storeHttp(request,true,['requestId','id','action','role','permissions'],(identity,body)=>reviewApplication(identity,requestStore(request),body));}
