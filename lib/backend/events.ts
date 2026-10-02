import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../supabase/server";
import { getSupabaseConfig, isSupabaseMode } from "../supabase/config";
import { getServerAccess, memberInTransaction } from "./context";
import { BackendError, withDatabase } from "./database";
import type { StaffMember } from "../staff";

type EventAccess = NonNullable<Awaited<ReturnType<typeof getServerAccess>>>;
const CONNECTION_MS = 45_000;
const SUBSCRIPTION_MS = 8_000;
const HEARTBEAT_MS = 5_000;
const CHECK_MS = 4_000;
const COALESCE_MS = 100;
const privateHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0, no-transform",
  "Pragma": "no-cache",
  "Expires": "0",
  "Referrer-Policy": "no-referrer",
};

function requireEventOrigin(request: Request) {
  const expected = new URL(process.env.APP_ORIGIN || request.url);
  if (expected.username || expected.password || !["http:", "https:"].includes(expected.protocol)) throw new BackendError("后台暂时不可用。", 503);
  const origin = request.headers.get("origin");
  // Native EventSource GETs may omit Origin. Explicit foreign origins are refused.
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== expected.origin)) throw new BackendError("请求来源无效。", 403);
  if (new URL(request.url).search) throw new BackendError("请求字段无效。", 400);
}

function guardAbort(request: Request) {
  if (request.signal.aborted) throw new BackendError("连接已取消。", 499);
}

function memberScope(member: StaffMember): string {
  return JSON.stringify([member.id, member.revision, member.role, member.accountStatus, member.membershipStatus, [...member.permissions].sort()]);
}

async function verifyAccess(access: EventAccess, scope: string) {
  // Each call opens a short transaction: no SQL connection is held by the stream.
  await withDatabase(access.identity, access.storeId, async tx => {
    const fresh = await memberInTransaction(tx, access.storeId, access.identity.userId);
    if (memberScope(fresh) !== scope) throw new BackendError("门店权限已变化。", 403);
  });
}

async function validatedToken(access: EventAccess): Promise<string> {
  const server = await createSupabaseServerClient();
  const { data: { session }, error } = await server.auth.getSession();
  if (error || !session || session.user.id !== access.identity.userId || typeof session.access_token !== "string") throw new BackendError("会话已失效，请重新登录。", 401);
  let claims: Record<string, unknown>;
  try {
    const parts = session.access_token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { throw new BackendError("会话已失效，请重新登录。", 401); }
  // getServerAccess already verified this identity with getUser/getClaims and live_user.
  // Local getSession is used only to transport its matching token to Realtime.
  if (!claims || claims.sub !== access.identity.userId || claims.session_id !== access.identity.sessionId || claims.role !== "authenticated" || typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) throw new BackendError("会话已失效，请重新登录。", 401);
  return session.access_token;
}

function broadcastRevision(message: unknown): number | null {
  if (!message || typeof message !== "object" || !("payload" in message)) return null;
  const payload = message.payload;
  // Database Broadcast may add a message id/_meta. Only the validated revision
  // is projected below; SDK metadata and business-shaped fields never leave here.
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("revision" in payload)) return null;
  return typeof payload.revision === "number" && Number.isSafeInteger(payload.revision) && payload.revision >= 0 ? payload.revision : null;
}

function eventStream(request: Request, access: EventAccess, token: string): ReadableStream<Uint8Array> {
  const scope = memberScope(access.member);
  const encoder = new TextEncoder();
  const { url, publishableKey } = getSupabaseConfig();
  // A request owns the client and token. The SDK callback keeps its explicit token
  // from being replaced by an empty auth session on a socket heartbeat.
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { timeout: SUBSCRIPTION_MS, accessToken: async () => token },
  });
  let channel: RealtimeChannel | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  let checking = false;
  let joined = false;
  let readyPending = false;
  let readySent = false;
  let heartbeatPending = false;
  let pendingRevision: number | null = null;
  let connectionTimer: ReturnType<typeof setTimeout> | undefined;
  let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let coalesceTimer: ReturnType<typeof setTimeout> | undefined;
  let disposal: Promise<void> | undefined;

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(connectionTimer);
    clearTimeout(subscriptionTimer);
    clearInterval(heartbeatTimer);
    clearTimeout(checkTimer);
    clearTimeout(coalesceTimer);
    request.signal.removeEventListener("abort", onAbort);
    try { controller.close(); } catch { /* Consumer may have cancelled already. */ }
    // removeAllChannels also tears down channel retry timers on unsubscribe timeout.
    // Always disconnect this exclusive socket, including cleanup failures.
    disposal = client.removeAllChannels().catch(() => { channel?.teardown(); }).then(async () => {
      await client.realtime.disconnect();
    }).catch(() => { /* Connection is closed; no rejection escapes an event callback. */ });
  }

  function emit(frame: string) {
    if (closed) return;
    // Slow/disconnected consumers must not create an unbounded server-side queue.
    if (controller.desiredSize !== null && controller.desiredSize <= 0) { close(); return; }
    try { controller.enqueue(encoder.encode(frame)); } catch { close(); }
  }

  function accessFailure(error: unknown) {
    if (error instanceof BackendError && (error.status === 401 || error.status === 403)) emit("event: access-changed\ndata: {}\n\n");
    close();
  }

  function onAbort() { close(); }

  function scheduleCheck() {
    if (closed || checking || coalesceTimer || !joined) return;
    coalesceTimer = setTimeout(() => {
      coalesceTimer = undefined;
      void check().catch(() => { close(); });
    }, COALESCE_MS);
  }

  async function check() {
    if (closed || checking) return;
    checking = true;
    // Capture work before authorization; newer messages need their own check.
    const revision = pendingRevision;
    const ready = readyPending;
    const heartbeat = heartbeatPending;
    pendingRevision = null;
    readyPending = false;
    heartbeatPending = false;
    checkTimer = setTimeout(close, CHECK_MS);
    try {
      await verifyAccess(access, scope);
      if (closed || request.signal.aborted) { close(); return; }
      if (ready && !readySent) { readySent = true; emit("event: ready\ndata: {}\n\n"); }
      if (revision !== null) {
        // Membership/roster changes may share a business revision. This is only
        // an invalidation hint; the state token decides whether facts changed.
        emit(`event: invalidate\ndata: ${JSON.stringify({ revision })}\n\n`);
      }
      if (heartbeat) emit(": heartbeat\n\n");
    } catch (error) { accessFailure(error); }
    finally {
      clearTimeout(checkTimer);
      checkTimer = undefined;
      checking = false;
      if (readyPending || heartbeatPending || pendingRevision !== null) scheduleCheck();
    }
  }

  async function connect() {
    try {
      await client.realtime.setAuth(token);
      if (closed || request.signal.aborted) { close(); return; }
      checking = true;
      checkTimer = setTimeout(close, CHECK_MS);
      await verifyAccess(access, scope);
      clearTimeout(checkTimer);
      checkTimer = undefined;
      checking = false;
      if (closed || request.signal.aborted) { close(); return; }
      channel = client.channel(`ct:store:${access.storeId}`, { config: { private: true } });
      channel.on("broadcast", { event: "changed" }, message => {
        if (closed) return;
        const revision = broadcastRevision(message);
        if (revision === null) return;
        pendingRevision = Math.max(pendingRevision ?? revision, revision);
        scheduleCheck();
      }).subscribe(status => {
        if (closed) return;
        if (status === "SUBSCRIBED") {
          clearTimeout(subscriptionTimer);
          joined = true;
          readyPending = !readySent;
          heartbeatTimer ??= setInterval(() => { heartbeatPending = true; scheduleCheck(); }, HEARTBEAT_MS);
          scheduleCheck();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") close();
      }, SUBSCRIPTION_MS);
    } catch (error) { accessFailure(error); }
  }

  return new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) { close(); return; }
      connectionTimer = setTimeout(close, CONNECTION_MS);
      subscriptionTimer = setTimeout(close, SUBSCRIPTION_MS);
      void connect().catch(() => { close(); });
    },
    cancel() { close(); return disposal; },
  }, { highWaterMark: 4 });
}

export async function createBackendEventsResponse(request: Request): Promise<Response> {
  try {
    if (!isSupabaseMode()) throw new BackendError("正式后台未启用。", 404);
    requireEventOrigin(request);
    guardAbort(request);
    const access = await getServerAccess();
    guardAbort(request);
    if (!access) throw new BackendError("当前账号尚未获得门店授权。", 403);
    const token = await validatedToken(access);
    guardAbort(request);
    return new Response(eventStream(request, access, token), {
      headers: { ...privateHeaders, "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no" },
    });
  } catch (error) {
    return Response.json({ message: error instanceof BackendError ? error.message : "后台暂时不可用，请稍后重试。" }, {
      status: error instanceof BackendError ? error.status : 503,
      headers: privateHeaders,
    });
  }
}
