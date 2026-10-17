import 'server-only';
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {BackendError,withDatabase,type AuthIdentity} from '@/lib/backend/database';
/** Vercel overwrites x-forwarded-for. Non-Vercel local runs deliberately share
 * a loopback budget and never trust a caller-supplied forwarding header. */
export async function enforceStoreRate(request:Request,identity:AuthIdentity,writing:boolean){
 const forwarded=process.env.VERCEL==='1'?request.headers.get('x-forwarded-for')?.trim():undefined;
 const address=forwarded&&isIP(forwarded)?forwarded:'loopback-or-unavailable';
 const digest=createHmac('sha256',process.env.APP_DATABASE_URL!).update('chinatech:rate:v1\0'+address).digest('hex');
 const allowed=await withDatabase(identity,null,async tx=>{const [row]=await tx`select chinatech_v2_private.consume_store_api_rate(${digest},${writing}) as allowed`;return row.allowed;});
 if(!allowed)throw new BackendError('操作过于频繁，请稍后再试。',429);
}
