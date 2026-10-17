import type {NextRequest} from 'next/server';
import {storeHttp} from '@/lib/server/store-http';
import {BackendError} from '@/lib/backend/database';
import {createStore,myStores} from '@/lib/server/stores';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return storeHttp(request,false,[],async identity=>{for(const key of request.nextUrl.searchParams.keys())if(key!=='applicationCursor'||request.nextUrl.searchParams.getAll(key).length!==1)throw new BackendError('分页请求无效。');return {...await myStores(identity,request.nextUrl.searchParams.get('applicationCursor')??undefined),accountId:identity.userId,sessionId:identity.sessionId};});}
export function POST(request:NextRequest){return storeHttp(request,true,['requestId','name'],(identity,body)=>createStore(identity,body.requestId,body.name));}
