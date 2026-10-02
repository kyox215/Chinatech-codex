import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/backend/events.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storeId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000003";
const member = { id: "synthetic-member", revision: 1, role: "viewer", accountStatus: "active", membershipStatus: "active", permissions: ["repairs.view"] };
const flush = async () => { await setImmediate(); await setImmediate(); };

function token(claims = {}) {
  return "synthetic." + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, ...claims })).toString("base64url") + ".synthetic";
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness() {
  class BackendError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const h = {
    access: { storeId, identity: { userId, sessionId }, member: structuredClone(member) },
    fresh: structuredClone(member), accessCalls: 0, sessionCalls: 0, checks: 0, activeChecks: 0, maxChecks: 0,
    clients: [], checkError: null, checkHold: null, accessHold: null, authHold: null, token: token(), sessionUserId: userId,
  };
  const timers = new Map();
  let nextId = 0, now = 0;
  function addTimer(fn, delay, repeat = false) { const id = ++nextId; timers.set(id, { fn, at: now + delay, delay, repeat }); return id; }
  h.advance = async milliseconds => {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, value] = next; now = value.at;
      if (value.repeat) value.at += value.delay; else timers.delete(id);
      value.fn(); await flush();
    }
    now = end; await flush();
  };
  h.timerCount = () => timers.size;
  const exports = {};
  runInContext(compiled, createContext({
    exports, Buffer, URL, Request, Response, ReadableStream, TextEncoder, Date, Promise,
    process: { env: { APP_ORIGIN: "https://shop.example.test", NODE_ENV: "production" } },
    setTimeout: (fn, delay) => addTimer(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => addTimer(fn, delay, true), clearInterval: id => timers.delete(id),
    require: name => {
      if (name === "../supabase/config") return { isSupabaseMode: () => true, getSupabaseConfig: () => ({ url: "https://project.example.test", publishableKey: "sb_publishable_synthetic" }) };
      if (name === "../supabase/server") return { createSupabaseServerClient: async () => ({ auth: { getSession: async () => {
        h.sessionCalls++; return { data: { session: { user: { id: h.sessionUserId }, access_token: h.token } }, error: null };
      } } }) };
      if (name === "./context") return {
        getServerAccess: async () => { h.accessCalls++; if (h.accessHold) await h.accessHold.promise; if (h.access instanceof Error) throw h.access; return h.access; },
        memberInTransaction: async () => { if (h.checkError) throw h.checkError; return h.fresh; },
      };
      if (name === "./database") return { BackendError, withDatabase: async (identity, scope, run) => {
        assert.deepEqual(JSON.parse(JSON.stringify(identity)), { userId, sessionId }); assert.equal(scope, storeId);
        h.checks++; h.activeChecks++; h.maxChecks = Math.max(h.maxChecks, h.activeChecks);
        try { if (h.checkHold) await h.checkHold.promise; return await run({}); } finally { h.activeChecks--; }
      } };
      if (name === "@supabase/supabase-js") return { createClient: (url, key, options) => {
        const client = {
          url, key, options, authTokens: [], channels: [], removed: 0, disconnected: 0,
          realtime: { setAuth: async value => { client.authTokens.push(value); if (h.authHold) await h.authHold.promise; }, disconnect: async () => { client.disconnected++; if (client.disconnectError) throw new Error("Synthetic cleanup failure"); } },
          channel: (topic, config) => {
            const channel = {
              topic, config, tornDown: 0,
              on(type, filter, fn) { assert.equal(type, "broadcast"); assert.equal(filter.event, "changed"); this.broadcast = fn; return this; },
              subscribe(fn, deadline) { this.status = fn; this.deadline = deadline; return this; },
              teardown() { this.tornDown++; },
            };
            client.channels.push(channel); return channel;
          },
          removeAllChannels: async () => { client.removed++; if (client.removeError) throw new Error("Synthetic cleanup failure"); client.channels.forEach(channel => channel.teardown()); },
        };
        h.clients.push(client); return client;
      } };
      throw new Error("Unexpected dependency: " + name);
    },
  }), { filename: "lib/backend/events.ts" });
  h.BackendError = BackendError;
  h.call = (headers = {}, suffix = "", signal) => exports.createBackendEventsResponse(new Request("https://shop.example.test/api/backend/events" + suffix, { headers, signal }));
  h.open = async () => {
    const response = await h.call(); assert.equal(response.status, 200); await flush();
    const client = h.clients.at(-1), channel = client.channels[0];
    channel.status("SUBSCRIBED"); await h.advance(100);
    return { response, reader: response.body.getReader(), client, channel };
  };
  return h;
}

async function read(reader) { const result = await reader.read(); return result.done ? null : new TextDecoder().decode(result.value); }

test("SSE refuses cross-site/origin and scope injection before consulting the session", async () => {
  const h = harness();
  for (const headers of [{ origin: "https://attacker.invalid" }, { "sec-fetch-site": "cross-site" }, { origin: "null" }]) assert.equal((await h.call(headers)).status, 403);
  assert.equal((await h.call({}, "?storeId=foreign&topic=anything")).status, 400);
  assert.equal(h.accessCalls, 0); assert.equal(h.clients.length, 0);
});

test("SSE returns anonymous 401 and unauthorized 403 without opening a socket", async () => {
  const h = harness(); h.access = new h.BackendError("Synthetic missing session", 401);
  assert.equal((await h.call()).status, 401);
  h.access = null; assert.equal((await h.call()).status, 403);
  assert.equal(h.sessionCalls, 0); assert.equal(h.clients.length, 0);
});

test("getSession token must match verified user, JWT subject/session and expiry", async () => {
  for (const bad of [{ sub: "another-user" }, { session_id: "another-session" }, { role: "service_role" }, { exp: 1 }]) {
    const h = harness(); h.token = token(bad); assert.equal((await h.call()).status, 401); assert.equal(h.clients.length, 0);
  }
  const h = harness(); h.sessionUserId = "another-user"; assert.equal((await h.call()).status, 401); assert.equal(h.clients.length, 0);
});

test("SSE uses a private server-chosen topic and never transports token or business fields", async () => {
  const h = harness(), { response, reader, client, channel } = await h.open();
  assert.equal(channel.topic, "ct:store:" + storeId); assert.equal(channel.config.config.private, true);
  assert.equal(client.options.auth.persistSession, false); assert.equal(client.options.auth.autoRefreshToken, false);
  assert.equal(await client.options.realtime.accessToken(), h.token); assert.equal(client.authTokens[0], h.token);
  assert.equal(channel.deadline, 8000); assert.equal(h.checks, 2);
  assert.match(response.headers.get("cache-control"), /no-store/); assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const ready = await read(reader); assert.equal(ready, "event: ready\ndata: {}\n\n"); assert.equal(ready.includes(h.token), false);
  for (const payload of [{ revision: "2" }, { revision: -1 }, { revision: Number.MAX_SAFE_INTEGER + 1 }]) channel.broadcast({ payload });
  await h.advance(100); assert.equal(h.checks, 2);
  channel.broadcast({ payload: { id: "sdk-message-id", _meta: {}, revision: 2, privateCost: 123 } }); await h.advance(100);
  assert.equal(await read(reader), "event: invalidate\ndata: {\"revision\":2}\n\n");
  await reader.cancel(); await flush(); assert.equal(client.removed, 1); assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
});

test("notification bursts coalesce and newer messages cannot bypass an in-flight access check", async () => {
  const h = harness(), { reader, channel } = await h.open(); await read(reader);
  channel.broadcast({ payload: { revision: 2 } }); channel.broadcast({ payload: { revision: 4 } }); channel.broadcast({ payload: { revision: 3 } });
  h.checkHold = deferred(); await h.advance(100); assert.equal(h.checks, 3);
  channel.broadcast({ payload: { revision: 5 } }); await h.advance(100); assert.equal(h.checks, 3);
  h.checkHold.resolve(); await flush(); h.checkHold = null;
  assert.equal(await read(reader), "event: invalidate\ndata: {\"revision\":4}\n\n");
  h.fresh = { ...h.fresh, revision: 2, permissions: [] }; await h.advance(100);
  assert.equal(await read(reader), "event: access-changed\ndata: {}\n\n"); assert.equal(await read(reader), null);
  assert.equal(h.maxChecks, 1); assert.equal(h.timerCount(), 0);
});

test("same or older business revision still invalidates changed roster/account state", async () => {
  const h = harness(), { reader, channel } = await h.open(); await read(reader);
  for (const revision of [4, 4, 3]) {
    channel.broadcast({ payload: { revision } }); await h.advance(100);
    assert.equal(await read(reader), `event: invalidate\ndata: {\"revision\":${revision}}\n\n`);
  }
  assert.equal(h.checks, 5); await reader.cancel();
});

test("heartbeat catches revoked sessions even when no broadcast arrives", async () => {
  const h = harness(), { reader, client } = await h.open(); await read(reader);
  h.checkError = new h.BackendError("Synthetic revoked session", 401); await h.advance(5100);
  assert.equal(await read(reader), "event: access-changed\ndata: {}\n\n"); assert.equal(await read(reader), null);
  assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
});

test("slow membership checks close at a bounded deadline and never overlap or forward late", async () => {
  const h = harness(), { reader, channel, client } = await h.open(); await read(reader);
  h.checkHold = deferred(); channel.broadcast({ payload: { revision: 9 } }); await h.advance(100);
  await h.advance(4000); assert.equal(await read(reader), null); assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
  h.checkHold.resolve(); await flush(); assert.equal(h.maxChecks, 1); assert.equal(h.checks, 3); assert.equal(h.timerCount(), 0);
});

test("subscription failure and eight-second join timeout clean sockets and timers", async () => {
  for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", null]) {
    const h = harness(), response = await h.call(); await flush(); const client = h.clients[0];
    if (status) client.channels[0].status(status); else await h.advance(8000);
    await flush(); assert.equal(await response.body.getReader().read().then(value => value.done), true);
    assert.equal(client.removed, 1); assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
  }
});

test("abort during identity and membership await windows cannot create or rejoin a socket", async () => {
  const h = harness(), abort = new AbortController(); h.accessHold = deferred();
  const pending = h.call({}, "", abort.signal); abort.abort(); h.accessHold.resolve();
  assert.equal((await pending).status, 499); assert.equal(h.clients.length, 0); assert.equal(h.sessionCalls, 0);
  const h2 = harness(), abort2 = new AbortController(); h2.checkHold = deferred();
  const response = await h2.call({}, "", abort2.signal); await flush(); abort2.abort(); await flush();
  assert.equal(h2.clients[0].removed, 1); assert.equal(h2.timerCount(), 0);
  h2.checkHold.resolve(); await flush(); assert.equal(h2.clients[0].channels.length, 0);
  assert.equal(await response.body.getReader().read().then(value => value.done), true);
  const h3 = harness(), abort3 = new AbortController(); h3.authHold = deferred();
  const beforeAuth = await h3.call({}, "", abort3.signal); await flush(); abort3.abort(); h3.authHold.resolve(); await flush();
  assert.equal(h3.checks, 0); assert.equal(h3.clients[0].channels.length, 0); assert.equal(h3.clients[0].disconnected, 1);
  assert.equal(await beforeAuth.body.getReader().read().then(value => value.done), true); assert.equal(h3.timerCount(), 0);
});

test("cleanup failures still tear down the channel and cannot escape as rejected event callbacks", async () => {
  const h = harness(), { reader, channel, client } = await h.open(); await read(reader);
  client.removeError = true; client.disconnectError = true;
  await reader.cancel(); await flush();
  assert.equal(channel.tornDown, 1); assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
  channel.status("CHANNEL_ERROR"); channel.broadcast({ payload: { revision: 100 } }); await h.advance(100);
  assert.equal(h.checks, 2); assert.equal(client.removed, 1);
});

test("connections rotate after 45 seconds and a stalled consumer has bounded buffering", async () => {
  const h = harness(), { reader, client } = await h.open(); await read(reader);
  for (let i = 0; i < 8; i++) { await h.advance(5000); assert.equal(await read(reader), ": heartbeat\n\n"); }
  await h.advance(5000); assert.equal(await read(reader), null); assert.equal(client.disconnected, 1); assert.equal(h.timerCount(), 0);
  const stalled = harness(), opened = await stalled.open();
  await stalled.advance(21000); assert.equal(opened.client.disconnected, 1); assert.equal(stalled.timerCount(), 0);
  let frames = 0; while (await read(opened.reader) !== null) frames++;
  assert.equal(frames, 4);
});

test("simultaneous requests own different sockets and cancelling one leaves the other active", async () => {
  const h = harness(), first = await h.open(), second = await h.open(); await read(first.reader); await read(second.reader);
  assert.notEqual(first.client, second.client); await first.reader.cancel(); await flush();
  second.channel.broadcast({ payload: { revision: 7 } }); await h.advance(100);
  assert.equal(await read(second.reader), "event: invalidate\ndata: {\"revision\":7}\n\n"); assert.equal(second.client.disconnected, 0);
  await second.reader.cancel(); await flush(); assert.equal(h.timerCount(), 0);
});
