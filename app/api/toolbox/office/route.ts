import { NextRequest, NextResponse } from 'next/server';
import { readAuthBody, requireSameOrigin } from '@/lib/supabase/server';
import { buildOfficeCommand, officeAction, officeOrigin, officeTerminal, signOfficeToken, OfficeError } from '@/lib/toolbox/office-token';
import { officeFailure, officeResponse, officeScript, publicOfficeState } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{return officeResponse(NextResponse.json(await publicOfficeState()));}catch(e){return officeFailure(e);}}
export async function POST(request:NextRequest){try{
  requireSameOrigin(request);
  const body=await readAuthBody(request,['action','terminal','language']);
  const action=officeAction(body.action),terminal=officeTerminal(body.terminal);
  if(!['zh-CN','it','en'].includes(String(body.language))||typeof body.language!=='string')throw new OfficeError('语言选项无效。',400);
  const state=await publicOfficeState();if(!state.enabled)throw new OfficeError('Office 命令已停用。',403);
  const {digest}=await officeScript(action),origin=officeOrigin();
  const token=signOfficeToken({v:1,action,epoch:state.version,digest});
  const command=buildOfficeCommand(origin,token,digest,terminal,body.language);
  return officeResponse(NextResponse.json({action,terminal,version:state.version,command,sourceUrl:'/api/toolbox/office/script?token='+encodeURIComponent(token)}));
}catch(e){return officeFailure(e);}}
