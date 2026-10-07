import { NextRequest, NextResponse } from 'next/server';
import { requireAccountSession } from '@/lib/server/account-auth';
import { copyAuthCookies } from '@/lib/server/auth-flows';
import { readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { isSupabaseMode } from '@/lib/supabase/config';
import { OfficeError } from '@/lib/toolbox/office-token';
import { getOfficeAdmin, updateOfficeAdmin, officeFailure, officeResponse } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){const response=officeResponse(NextResponse.json({}));try{
  if(!isSupabaseMode())throw new OfficeError('网站工具箱管理暂未开放。',404);
  const {identity}=await requireAccountSession(request,response);
  return copyAuthCookies(response,officeResponse(NextResponse.json(await getOfficeAdmin(identity))));
}catch(e){return copyAuthCookies(response,officeFailure(e));}}
export async function PATCH(request:NextRequest){const response=officeResponse(NextResponse.json({}));try{
  if(!isSupabaseMode())throw new OfficeError('网站工具箱管理暂未开放。',404);
  requireSameOrigin(request);
  const {identity}=await requireAccountSession(request,response,true);
  if(request.headers.get('x-ct-session-id')!==identity.sessionId)throw new OfficeError('登录会话已变化，请刷新后重试。',409);
  const body=await readAuthBody(request,['enabled','expectedRevision','requestId']);
  if(typeof body.enabled!=='boolean'||typeof body.expectedRevision!=='string'||! /^(0|[1-9][0-9]{0,18})$/.test(body.expectedRevision)||BigInt(body.expectedRevision)>BigInt("9223372036854775807")||typeof body.requestId!=='string'|| !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId))throw new OfficeError('开关请求无效。',400);
  return copyAuthCookies(response,officeResponse(NextResponse.json(await updateOfficeAdmin(identity,body.enabled,body.expectedRevision,body.requestId))));
}catch(e){return copyAuthCookies(response,officeFailure(e));}}
