import { NextRequest, NextResponse } from 'next/server';
import { assertOfficePermission, readOfficeToken, OfficeError } from '@/lib/toolbox/office-token';
import { officeFailure, officeResponse, officeScript, publicOfficeState } from '@/lib/toolbox/office-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){try{
  const payload=readOfficeToken(request.nextUrl.searchParams.get('token'));
  assertOfficePermission(await publicOfficeState(),payload);
  const {body,digest}=await officeScript(payload.action);
  if(digest!==payload.digest)throw new OfficeError('命令已失效，请重新生成。',410);
  return officeResponse(new NextResponse(new Uint8Array(body),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`inline; filename="office-${payload.action}.ps1.txt"`}}));
}catch(e){return officeFailure(e);}}
