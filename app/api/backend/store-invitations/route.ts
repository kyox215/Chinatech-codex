import type {NextRequest} from 'next/server';
import {storeHttp,requestStore} from '@/lib/server/store-http';
import {createInvitation,listAdmission,revokeInvitation,requiredUuid} from '@/lib/server/stores';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return storeHttp(request,false,[],identity=>listAdmission(identity,requestStore(request)));}
export function POST(request:NextRequest){return storeHttp(request,true,['requestId','action','id'],(identity,body)=>body.action==='revoke'?revokeInvitation(identity,requestStore(request),requiredUuid(body.id),requiredUuid(body.requestId)):createInvitation(identity,requestStore(request),requiredUuid(body.requestId)));}
