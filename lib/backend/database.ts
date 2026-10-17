import postgres, { type TransactionSql } from "postgres";
import {observe,observeTime,observedTransaction} from "./request-observation";

export type AuthIdentity = { userId: string; sessionId: string };
let connection: ReturnType<typeof postgres> | undefined;
function database() {
  const url = process.env.APP_DATABASE_URL;
  if (!url) throw new Error("正式数据库尚未配置。");
  const parsed = new URL(url);
  const username=decodeURIComponent(parsed.username);
  const configuredRef=new URL(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost").hostname.split(".")[0];
  if (username !== "chinatech_runtime" && username !== "chinatech_runtime."+configuredRef) throw new Error("正式业务连接必须使用此项目的受限运行角色。");
  connection ??= postgres(url, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 10, ssl: parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? false : "require" });
  return connection;
}
export async function enrollLogin(identity: AuthIdentity, remember: boolean, browser: string, os: string) {
  await database().begin(async tx => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: identity.userId, session_id: identity.sessionId, role: "authenticated" })},true)`;
    await tx`select chinatech_v2_private.enroll_login_session(${remember},${browser},${os})`;
  });
}
async function databaseTransaction<T>(identity: AuthIdentity, storeId: string | null, run: (tx: TransactionSql) => Promise<T>,isolation:"serializable"|"read committed"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const acquiring=performance.now();let callbackEnded:number|undefined,attemptEnded:number|undefined;
    try { return await database().begin("isolation level "+isolation, async rawTx => {
    observe("db_acquire",performance.now()-acquiring);
    const tx=observedTransaction(rawTx);
    try{
    await observeTime("db_session",async()=>{
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: identity.userId, session_id: identity.sessionId, role: "authenticated" })},true), set_config('app.store_id',${storeId ?? ""},true),set_config('statement_timeout','10000',true)`;
    // Lock the project session before checking validity; revocation serializes with writes.
    await observeTime("db_lock",async()=>{
    const locked = await tx`select session_id from chinatech_v2_private.login_sessions where session_id=${identity.sessionId} and user_id=${identity.userId} for share`;
    if (!locked.length) {
      await tx`select chinatech_v2_private.adopt_cutover_login_session()`;
      await tx`select session_id from chinatech_v2_private.login_sessions where session_id=${identity.sessionId} and user_id=${identity.userId} for share`;
    }
    });
    const [live] = await observeTime("db_live",async()=>tx<{ live: boolean }[]>`select chinatech_v2_private.live_user() as live`);
    if (!live?.live) throw new BackendError("会话已失效，请重新登录。", 401);
    });
    return await observeTime("db_work",()=>run(tx));
    }finally{callbackEnded=performance.now();}
    }) as T; }
    catch (error) {
      attemptEnded=performance.now();
      // Retry the WHOLE transaction, including session, membership and versions.
      // Business conflicts and unknown commit outcomes must never be retried here.
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
      observe(error instanceof StoreSessionRequired?"db_enroll_needed":code==="40001"?"db_40001":code==="40P01"?"db_40p01":"db_error",0);
      if ((code !== "40001" && code !== "40P01") || attempt >= 2) throw error;
      observe("db_retry",0);
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }finally{const ended=attemptEnded??performance.now();observe("db_total",ended-acquiring);if(callbackEnded!==undefined)observe("db_finish",ended-callbackEnded);else observe("db_acquire",ended-acquiring);}
  }
}
export function withDatabase<T>(identity:AuthIdentity,storeId:string|null,run:(tx:TransactionSql)=>Promise<T>){return databaseTransaction(identity,storeId,run,"serializable");}
// Internal read admission only. No canonical mutation or operation receipt is
// retried through this branch. The interrupted read has not read business data.
export class StoreSessionRequired extends Error {constructor(readonly storeId:string){super();}}
export async function withReadDatabase<T>(identity:AuthIdentity,storeId:string|null,run:(tx:TransactionSql)=>Promise<T>):Promise<T>{
 try{return await withDatabase(identity,storeId,run);}catch(error){
  if(!(error instanceof StoreSessionRequired))throw error;
  const target=error.storeId;
  if(!/^[a-f0-9-]{36}$/i.test(target)||storeId!==null&&target!==storeId)throw new BackendError("此设备无法访问本门店，请重新登录或联系老板。",403);
  // Register this session once outside the serializable business snapshot.
  // Concurrent cold arrivals otherwise read each other's admission predicates
  // while inserting their own rows, creating SSI cycles even for distinct IDs.
  await databaseTransaction(identity,target,async tx=>{
   const [allowed]=await tx`select chinatech_v2_private.member_access(${target}) as allowed`;
   if(!allowed?.allowed)throw new BackendError("此设备无法访问本门店，请重新登录或联系老板。",403);
   await observeTime("db_enroll",async()=>tx`insert into chinatech_v2_private.store_login_sessions(store_id,session_id,user_id) values(${target},${identity.sessionId},${identity.userId}) on conflict do nothing`);
  },"read committed");
  // Authorization, session locks, member revision and all business reads are
  // re-evaluated in a new serializable snapshot after registration commits.
  return withDatabase(identity,storeId,run);
 }
}
export class BackendError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

// Public Office reads expose one control row only, without inventing an Auth identity.
export async function readOfficeControl(): Promise<{ enabled: boolean; version: string }> {
  return database().begin(async tx => {
    await tx`select set_config('request.jwt.claims','{"role":"anon"}',true),set_config('statement_timeout','5000',true)`;
    const [row] = await tx<{ enabled: boolean; version: string }[]>`select enabled,command_version::text as version from chinatech_v2_private.office_command_control where singleton=true`;
    if (!row) throw new BackendError("Office 服务暂不可用，请稍后重试。",503);
    return row;
  }) as Promise<{ enabled: boolean; version: string }>;
}

// Startup status is a public boolean only; it does not adopt or fabricate an Auth session.
export async function readOfficeDesktopAdmission(): Promise<{ acceptingNewSessions: boolean; minimumVersion: string; releaseReady: boolean; verifiedVersion: string | null }> {
  return database().begin(async tx => {
    await tx`select set_config('request.jwt.claims','{"role":"anon"}',true),set_config('statement_timeout','5000',true)`;
    const [row] = await tx<{ accepting_new_sessions: boolean; minimum_version: string; release_ready: boolean; verified_version: string | null }[]>`select c.enabled and d.enabled as accepting_new_sessions,d.minimum_version,d.release_ready,d.verified_version from chinatech_v2_private.office_command_control c cross join chinatech_v2_private.office_desktop_control d where c.singleton and d.singleton`;
    if (!row) throw new BackendError('Office 服务暂不可用，请稍后重试。', 503);
    return { acceptingNewSessions: row.accepting_new_sessions, minimumVersion: row.minimum_version, releaseReady: row.release_ready, verifiedVersion: row.verified_version };
  }) as Promise<{ acceptingNewSessions: boolean; minimumVersion: string; releaseReady: boolean; verifiedVersion: string | null }>;
}

// Server-issued public capabilities remain separate from Auth and legacy key scopes.
export async function withOfficePublicDatabase<T>(grantId: string, installationId: string, issuing: boolean, run: (tx: TransactionSql) => Promise<T>): Promise<T> {
  if (!/^[a-f0-9-]{36}$/.test(grantId) || !/^[a-f0-9-]{36}$/.test(installationId)) throw new BackendError('请求无效。', 400);
  for (let attempt = 0; ; attempt++) {
    try { return await database().begin('isolation level read committed', async tx => {
      await tx`select set_config('request.jwt.claims','{"role":"anon"}',true),set_config('app.office_desktop_grant_id',${grantId},true),set_config('app.office_desktop_installation',${installationId},true),set_config('app.office_desktop_public_issue',${issuing ? 'true' : 'false'},true),set_config('statement_timeout','10000',true)`;
      return run(tx);
    }) as T; } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if ((code !== '40001' && code !== '40P01') || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

// Desktop capabilities are independent from Auth identities. Never synthesize an Auth user.
export async function withOfficeDesktopDatabase<T>(keyHash: string, installationId: string, run: (tx: TransactionSql) => Promise<T>): Promise<T> {
  if (!/^[a-f0-9]{64}$/.test(keyHash) || !/^[a-f0-9-]{36}$/.test(installationId)) throw new BackendError('请求无效。', 400);
  for (let attempt = 0; ; attempt++) {
    try { return await database().begin('isolation level read committed', async tx => {
      await tx`select set_config('request.jwt.claims','{"role":"anon"}',true), set_config('app.office_desktop_key_hash',${keyHash},true), set_config('app.office_desktop_installation',${installationId},true), set_config('statement_timeout','10000',true)`;
      return run(tx);
    }) as T; } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if ((code !== '40001' && code !== '40P01') || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}
