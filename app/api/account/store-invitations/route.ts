import type {NextRequest} from 'next/server';
import {storeHttp} from '@/lib/server/store-http';
import {invitationAction} from '@/lib/server/stores';
export const dynamic='force-dynamic';
// Token travels in POST JSON rather than URLs, access logs or referrers.
export function POST(request:NextRequest){return storeHttp(request,true,['token','requestId'],(identity,body)=>invitationAction(identity,body.token,body.requestId));}
