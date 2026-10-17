import type {NextRequest} from 'next/server';
import {storeHttp} from '@/lib/server/store-http';
import {invitationAction} from '@/lib/server/stores';
import {BackendError} from '@/lib/backend/database';
import {clearInvitationContext,readInvitationContext,setInvitationContext} from '@/lib/server/store-invitation-context';
export const dynamic='force-dynamic';
// Token travels in POST JSON rather than URLs, access logs or referrers.
export async function POST(request:NextRequest){
 let checked:{token:string;accountId:string;expiresAt?:string}|null=null,applied=false,usingContext=false;
 const response=await storeHttp(request,true,['token','requestId','useContext'],async(identity,body)=>{
  if(body.useContext!==undefined&&body.useContext!==true)throw new BackendError('请求格式无效。');
  usingContext=body.useContext===true;
  const context=readInvitationContext(request);
  if(usingContext&&(body.token!==undefined||!context||(context.accountId&&context.accountId!==identity.userId)))throw new BackendError('邀请无效或已过期。',410);
  const token=usingContext?context!.token:body.token;
  const result=await invitationAction(identity,token,body.requestId);
  applied=body.requestId!==undefined||result.applied===true;
  checked={token:String(token),accountId:identity.userId,expiresAt:result.expiresAt};
  return result;
 });
 if((response.ok&&applied)||(usingContext&&response.status===410))clearInvitationContext(response);
 else if(response.ok&&checked){const value=checked as {token:string;accountId:string;expiresAt?:string};setInvitationContext(response,value.token,readInvitationContext(request),value.accountId,value.expiresAt);}
 return response;
}

// Only a verified, live account may inspect its held candidate. The bearer
// secret is never returned; after this first read the context is account-bound.
export async function GET(request:NextRequest){
 let checked:{accountId:string;expiresAt?:string;applied?:boolean}|null=null,clear=false;
 const context=readInvitationContext(request);
 const response=await storeHttp(request,false,[],async identity=>{
  if(!context||context.accountId&&context.accountId!==identity.userId){clear=true;return {hasInvitation:false};}
  const result=await invitationAction(identity,context.token);
  checked={accountId:identity.userId,expiresAt:result.expiresAt,applied:result.applied};
  return {...result,hasInvitation:true};
 });
 if(clear||response.status===410||response.ok&&(checked as {applied?:boolean}|null)?.applied)clearInvitationContext(response);
 else if(response.ok&&checked&&context){const value=checked as {accountId:string;expiresAt?:string};setInvitationContext(response,context.token,context,value.accountId,value.expiresAt);}
 return response;
}
