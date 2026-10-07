import postgres, { type TransactionSql } from "postgres";

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
export async function withDatabase<T>(identity: AuthIdentity, storeId: string | null, run: (tx: TransactionSql) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await database().begin("isolation level serializable", async tx => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: identity.userId, session_id: identity.sessionId, role: "authenticated" })},true), set_config('app.store_id',${storeId ?? ""},true),set_config('statement_timeout','10000',true)`;
    const [live] = await tx<{ live: boolean }[]>`select chinatech_v2_private.live_user() as live`;
    if (!live?.live) throw new BackendError("会话已失效，请重新登录。", 401);
    return await run(tx);
    }) as T; }
    catch (error) {
      // Retry the WHOLE transaction, including session, membership and versions.
      // Business conflicts and unknown commit outcomes must never be retried here.
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
      if ((code !== "40001" && code !== "40P01") || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
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
