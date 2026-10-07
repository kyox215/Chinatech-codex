import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
const userA = "11111111-1111-4111-8111-111111111111", userB = "22222222-2222-4222-8222-222222222222";
function harness() {
  const state = { clock: Date.now(), calls: [], settingsStatus: 200, external: { google: true, apple: true, phone: true }, exchangeUser: userA, verifyUser: userA, linkedProvider: "google", changedEmail: "", live: true,
    users: { [userA]: { id: userA, email: "first@example.test", email_confirmed_at: "2026-01-01", new_email: "", phone: "", new_phone: "390123456789", phone_confirmed_at: null, identities: [], user_metadata: { role: "owner" } }, [userB]: { id: userB, email: "second@example.test", email_confirmed_at: "2026-01-01", identities: [] } } };
  class Clock extends Date { static now() { return state.clock; } }
  class BackendError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const cache = new Map();
  function client(request, response) {
    const current = () => state.users[request.cookies.get("test-user")?.value];
    const establish = id => {
      request.cookies.set("test-user", id); request.cookies.set("test-session", "new-session");
      response.cookies.set("ct_rebuild_auth", "new-session-for-" + id, { httpOnly: true });
      return { data: { user: state.users[id], session: { synthetic: true } }, error: null };
    };
    return { auth: {
      getUser: async () => ({ data: { user: current() ?? null }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: current()?.id, session_id: request.cookies.get("test-session")?.value } }, error: null }),
      updateUser: async attributes => { state.calls.push(["update", attributes]); Object.assign(current(), attributes.email ? { new_email: attributes.email } : { new_phone: attributes.phone }); return { data: { user: current() }, error: null }; },
      linkIdentity: async options => { state.calls.push(["link", options]); return { data: { url: options.provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth?state=synthetic" : "https://appleid.apple.com/auth/authorize?state=synthetic" }, error: null }; },
      exchangeCodeForSession: async (code, options) => { state.calls.push(["exchange", code, options]); const user = state.users[state.exchangeUser]; user.identities = [{ provider: state.linkedProvider, identity_data: { email: "provider@example.test" } }]; if (state.changedEmail) { user.email = state.changedEmail; user.new_email = ""; } return establish(state.exchangeUser); },
      verifyOtp: async options => { state.calls.push(["verify", options]); Object.assign(state.users[state.verifyUser], { phone: options.phone, new_phone: "", phone_confirmed_at: "2026-01-01" }); return establish(state.verifyUser); },
    } };
  }
  function load(path) {
    path = resolve(path); if (cache.has(path)) return cache.get(path);
    const exports = {};
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const context = createContext({ exports, process: { env: { NODE_ENV: "production", BACKEND_MODE: "supabase", APP_ORIGIN: "https://shop.example.test", SUPABASE_URL: "https://project.example.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", APP_DATABASE_URL: "synthetic-private-intent-key" } }, Buffer, URL, Headers, AbortSignal, Date: Clock,
      fetch: async () => new Response(JSON.stringify({ external: state.external, sms_provider: "twilio" }), { status: state.settingsStatus }),
      require: name => {
        if (name === "@/lib/toolbox/office-server") return { getOfficeAdmin: async () => { if (!state.officeAdmin) throw new Error("not admin"); return {}; } };
        if (name === "@/lib/backend/database") return { BackendError, withDatabase: async (identity, storeId, action) => { assert.equal(storeId, null); state.calls.push(["live", identity]); if (!state.live) throw new BackendError("revoked", 401); return action(); } };
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
        if (name.startsWith("./") || name.startsWith("../")) return load(resolve(dirname(path), name + ".ts"));
        return require(name);
      },
    });
    runInContext(code, context, { filename: path });
    if (path.endsWith("/lib/supabase/server.ts")) exports.createSupabaseRouteClient = client;
    cache.set(path, exports); return exports;
  }
  const request = (path, body, { user = userA, session = "old-session", expected = userA, origin = "https://shop.example.test", cookie = "" } = {}) => new NextRequest("https://shop.example.test" + path, { method: body === undefined ? "GET" : "POST", headers: { origin, "content-type": "application/json", "x-ct-account-id": expected, cookie: `test-user=${user}; test-session=${session}; ${cookie}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const post = (path, body, options) => load(`app/api/auth/account/${path}/route.ts`).POST(request(`/api/auth/account/${path}`, body, options));
  function callback(kind = "google", target = "", options = {}) {
    const issued = NextResponse.json({});
    const intent = load("lib/server/account-auth.ts").issueAccountIntent(issued, { userId: userA, sessionId: "old-session" }, kind, target);
    const cookie = issued.cookies.get("ct_rebuild_account_intent");
    let query = `intent=${intent.nonce}`;
    if (!options.noCode) query += "&code=synthetic-auth-code&next=https%3A%2F%2Fforeign.invalid";
    return { request: request("/auth/account/callback?" + query, undefined, { ...options, cookie: `${cookie.name}=${cookie.value}` }), intent, cookie };
  }
  return { state, load, request, post, callback, finish: request => load("app/auth/account/callback/route.ts").GET(request) };
}
const notice = response => new URL(response.headers.get("location")).searchParams.get("notice");

test("account phone normalization preserves significant zeros and rejects invalid country codes, double prefixes and overflow", () => {
  const normalize = harness().load("lib/account.ts").normalizeAccountPhone;
  assert.equal(normalize("+39", "012 345-6789"), "+390123456789");
  assert.equal(normalize("+86", "13800138000"), "+8613800138000");
  assert.equal(normalize("+123", "456789"), "+123456789");
  for (const args of [["39", "012345"], ["+039", "123456"], ["+1234", "567890"], ["+39", "+390123456"], ["+39", ""], ["+39", "000000000000000"], ["+39", "123x456"]]) assert.throws(() => normalize(...args));
});

test("account projection excludes metadata and sessions; settings failure remains 503", async () => {
  const h = harness(), route = h.load("app/api/auth/account/route.ts");
  const response = await route.GET(h.request("/api/auth/account")); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.account.id, userA); assert.equal(body.account.pendingPhone, "+390123456789");
  assert.equal(JSON.stringify(body).includes("owner"), false); assert.equal(JSON.stringify(body).includes("session"), false);
  h.state.settingsStatus = 503; assert.equal((await route.GET(h.request("/api/auth/account"))).status, 503);
  h.state.live = false; assert.equal((await route.GET(h.request("/api/auth/account"))).status, 401);
});

test("all account writes reject cross origin and stale-tab expected account before mutating", async () => {
  const h = harness();
  const actions = [["link", { provider: "google" }], ["email", { email: "new@example.test" }], ["phone", { countryCode: "+39", number: "0123456789" }], ["phone/verify", { phone: "+390123456789", token: "123456" }]];
  for (const [path, body] of actions) {
    assert.equal((await h.post(path, body, { user: userB })).status, 409);
    assert.equal((await h.post(path, body, { origin: "https://foreign.invalid" })).status, 403);
    assert.equal((await h.post(path, { ...body, role: "owner" })).status, 400);
  }
  assert.equal(h.state.calls.some(([action]) => ["update", "verify", "link"].includes(action)), false);
});

test("link uses fixed callback and signed HttpOnly intent while accepting official upstream provider URL", async () => {
  for (const provider of ["google", "apple"]) {
    const h = harness(), response = await h.post("link", { provider });
    assert.equal(response.status, 200); assert.ok((await response.json()).redirectTo.startsWith(provider === "google" ? "https://accounts.google.com/" : "https://appleid.apple.com/"));
    const proof = response.cookies.get("ct_rebuild_account_intent"); assert.equal(proof.httpOnly, true); assert.equal(proof.secure, true);
    const options = h.state.calls.find(([action]) => action === "link")[1]; const url = new URL(options.options.redirectTo);
    assert.equal(url.origin, "https://shop.example.test"); assert.equal(url.pathname, "/auth/account/callback"); assert.ok(url.searchParams.get("intent"));
  }
});

test("provider URL allowlist rejects credentials, foreign hosts, deceptive suffixes, fragments and ports", () => {
  const check = harness().load("lib/server/account-oauth.ts").checkedProviderUrl;
  for (const url of ["http://accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com.evil.test/o/oauth2/v2/auth", "https://user:pass@accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com:444/o/oauth2/v2/auth", "https://accounts.google.com/logout", "https://accounts.google.com/o/oauth2/v2/auth#secret", "javascript:alert(1)"]) assert.throws(() => check(url, "google", true));
});

test("account callback verifies original account and session before exchanging or writing new cookies", async () => {
  for (const options of [{ user: userB }, { session: "another-session" }]) {
    const h = harness(), response = await h.finish(h.callback("google", "", options).request);
    assert.equal(notice(response), "account-failed"); assert.equal(h.state.calls.some(([action]) => action === "exchange"), false);
    assert.equal(response.cookies.get("ct_rebuild_auth"), undefined);
  }
});

test("tampered, missing nonce and expired account intent fail before exchange", async () => {
  for (const variant of ["tampered", "nonce", "expired"]) {
    const h = harness(), { request, cookie } = h.callback();
    if (variant === "tampered") request.cookies.set(cookie.name, cookie.value + "x");
    if (variant === "nonce") request.nextUrl.searchParams.delete("intent");
    if (variant === "expired") h.state.clock += 3_600_000;
    assert.equal(notice(await h.finish(request)), "account-failed"); assert.equal(h.state.calls.length, 0);
  }
});

test("foreign-user OAuth exchange is staged and never replaces original browser identity", async () => {
  const h = harness(); h.state.exchangeUser = userB;
  const response = await h.finish(h.callback().request);
  assert.equal(notice(response), "account-failed"); assert.equal(response.cookies.get("ct_rebuild_auth"), undefined);
});

test("successful link clears intent and always returns same-origin account settings", async () => {
  for (const provider of ["google", "apple"]) {
    const h = harness(); h.state.linkedProvider = provider;
    const response = await h.finish(h.callback(provider).request);
    assert.equal(notice(response), "linked"); assert.equal(new URL(response.headers.get("location")).origin, "https://shop.example.test");
    assert.equal(response.cookies.get("ct_rebuild_auth").value, "new-session-for-" + userA);
    assert.equal(response.cookies.get("ct_rebuild_account_intent").maxAge, 0);
  }
});

test("cancelled provider authorization does not exchange code or install any session cookies", async () => {
  for (const provider of ["google", "apple"]) {
    const h = harness(), { request } = h.callback(provider);
    request.nextUrl.searchParams.set("error", "access_denied");
    const response = await h.finish(request);
    assert.equal(notice(response), "account-failed");
    assert.equal(response.cookies.getAll().length, 0); assert.equal(h.state.calls.length, 0);
  }
});

test("email callback without code remains pending; code success also requires actual changed email", async () => {
  const h = harness();
  assert.equal(notice(await h.finish(h.callback("email", "new@example.test", { noCode: true }).request)), "email-pending");
  assert.equal(notice(await h.finish(h.callback("email", "new@example.test").request)), "account-failed");
  h.state.changedEmail = "new@example.test";
  assert.equal(notice(await h.finish(h.callback("email", "new@example.test").request)), "email-updated");
});

test("phone verification requires current pending number and stages foreign-user session away", async () => {
  const h = harness();
  assert.equal((await h.post("phone/verify", { phone: "+391111111111", token: "123456" })).status, 409);
  assert.equal(h.state.calls.some(([action]) => action === "verify"), false);
  h.state.verifyUser = userB;
  const response = await h.post("phone/verify", { phone: "+390123456789", token: "123456" });
  assert.equal(response.status, 409); assert.equal(response.cookies.get("ct_rebuild_auth"), undefined);
});

test("phone binding preserves leading zero and verified same-user identity is published only after authoritative check", async () => {
  const h = harness();
  const started = await h.post("phone", { countryCode: "+39", number: "0123456789" }); assert.equal(started.status, 200);
  assert.equal(h.state.calls.find(([action]) => action === "update")[1].phone, "+390123456789");
  const verified = await h.post("phone/verify", { phone: "+390123456789", token: "123456" }); assert.equal(verified.status, 200);
  assert.equal(h.state.calls.find(([action]) => action === "verify")[1].type, "phone_change");
  assert.equal(verified.cookies.get("ct_rebuild_auth").value, "new-session-for-" + userA);
});


test("Office management capability is explicit, metadata-independent and absent when unavailable", async () => {
 const h=harness(),route=h.load("app/api/auth/account/route.ts");
 let body=await (await route.GET(h.request("/api/auth/account"))).json();assert.equal(body.capabilities.canManageOffice,false);
 h.state.officeAdmin=true;body=await (await route.GET(h.request("/api/auth/account"))).json();assert.equal(body.capabilities.canManageOffice,true);
 h.state.officeAdmin=false;body=await (await route.GET(h.request("/api/auth/account"))).json();assert.equal(body.capabilities.canManageOffice,false);
});
