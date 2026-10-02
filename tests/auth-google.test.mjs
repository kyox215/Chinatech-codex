import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
function harness(google = true, apple = false) {
  const requests = [];
  let clock = Date.now();
  class TestDate extends Date { static now() { return clock; } }
  const env = { NODE_ENV: "production", BACKEND_MODE: "supabase", APP_ORIGIN: "https://shop.example.test", SUPABASE_URL: "https://project.example.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test", APP_DATABASE_URL: "synthetic-server-only-signing-secret" };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const context = createContext({ exports, process: { env }, Buffer, URL, AbortSignal, Date: TestDate, fetch: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify({ external: { google, apple } }), { status: 200 }); }, require: name => {
      if (name === "./config" || name === "@/lib/supabase/config") return load("lib/supabase/config.ts");
      if (name === "@/lib/supabase/server") return load("lib/supabase/server.ts");
      if (name === "@/lib/server/auth-flows") return load("lib/server/auth-flows.ts");
      if (name === "@/lib/server/account-oauth") return load("lib/server/account-oauth.ts");
      if (name === "@/lib/server/account-auth") return load("lib/server/account-auth.ts");
      if (name === "@/lib/backend/database") return { BackendError: class extends Error {}, withDatabase: () => { throw new Error("No database allowed in OAuth initiation."); } };
      return require(name);
    } });
    runInContext(code, context, { filename: path });
    cache.set(path, exports);
    return exports;
  }
  const handler = load("app/api/auth/google/route.ts").POST;
  const call = (body = {}, origin = env.APP_ORIGIN) => handler(new NextRequest(env.APP_ORIGIN + "/api/auth/google", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { call, requests, load, advance: seconds => { clock += seconds * 1000; } };
}

test("Google initiation uses actual SDK PKCE with secure HttpOnly cookie and fixed trusted callback", async () => {
  const h = harness(); const response = await h.call();
  assert.equal(response.status, 200);
  const body = await response.json(); const url = new URL(body.redirectTo);
  assert.equal(url.origin, "https://project.example.test");
  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  const callback = new URL(url.searchParams.get("redirect_to"));
  assert.equal(callback.origin, "https://shop.example.test"); assert.equal(callback.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  const verifierCookie = response.cookies.getAll().find(cookie => cookie.name === "ct_rebuild_auth-code-verifier");
  assert.ok(verifierCookie); assert.equal(verifierCookie.httpOnly, true); assert.equal(verifierCookie.secure, true); assert.equal(verifierCookie.sameSite, "lax");
  const encoded = decodeURIComponent(verifierCookie.value); assert.ok(encoded.startsWith("base64-"));
  const verifier = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8"));
  assert.equal(createHash("sha256").update(verifier).digest("base64url"), url.searchParams.get("code_challenge"));
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].url, "https://project.example.test/auth/v1/settings");
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(JSON.stringify(body).includes(verifier), false);
});

test("Google initiation rejects foreign origin and provider, role or redirect injection before contacting auth", async () => {
  const h = harness();
  assert.equal((await h.call({}, "https://attacker.invalid")).status, 403);
  for (const payload of [{ provider: "github" }, { role: "owner" }, { redirectTo: "https://attacker.invalid" }, { next: "//attacker.invalid" }]) assert.equal((await h.call(payload)).status, 400);
  assert.equal(h.requests.length, 0);
});

test("disabled provider fails clearly and does not create an OAuth verifier", async () => {
  const h = harness(false); const response = await h.call();
  assert.equal(response.status, 503); assert.match((await response.json()).message, /尚未配置/);
  assert.equal(response.cookies.getAll().length, 0);
});

test("Apple login uses the same real SDK PKCE server flow with a fixed provider and callback", async () => {
  const h = harness(true, true);
  const response = await h.load("app/api/auth/apple/route.ts").POST(new NextRequest("https://shop.example.test/api/auth/apple", { method: "POST", headers: { origin: "https://shop.example.test", "content-type": "application/json" }, body: "{}" }));
  assert.equal(response.status, 200);
  const url = new URL((await response.json()).redirectTo);
  assert.equal(url.origin, "https://project.example.test"); assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "apple"); assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(new URL(url.searchParams.get("redirect_to")).pathname, "/auth/callback");
  assert.ok(response.cookies.getAll().some(cookie => cookie.name === "ct_rebuild_auth-code-verifier" && cookie.httpOnly && cookie.secure));
});

test("signed recovery proof expires after fifteen minutes before consulting the auth service", async () => {
  const h = harness();
  const issued = NextResponse.json({});
  h.load("lib/server/auth-flows.ts").setRecoveryProof(issued, "synthetic-user", "synthetic-session");
  const proof = issued.cookies.get("ct_rebuild_recovery");
  assert.equal(proof.maxAge, 900); assert.equal(proof.httpOnly, true); assert.equal(proof.secure, true);
  h.advance(900);
  const response = await h.load("app/api/auth/reset-password/route.ts").GET(new NextRequest("https://shop.example.test/api/auth/reset-password", { headers: { cookie: `${proof.name}=${proof.value}` } }));
  assert.equal(response.status, 401);
  assert.equal(response.cookies.get("ct_rebuild_recovery").maxAge, 0);
  assert.equal(h.requests.length, 0);
});

test("temporary recovery verification failures retain proof and return 503; invalid proof returns 401", async () => {
  let cleared = false;
  class RequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
  for (const [reason, expectedStatus, shouldClear] of [[new Error("synthetic connection failure"), 503, false], [new RequestError("invalid recovery", 401), 401, true]]) {
    cleared = false;
    const exports = {};
    const code = ts.transpileModule(readFileSync("app/api/auth/reset-password/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInContext(code, createContext({ exports, require: name => {
      if (name === "@/lib/supabase/config") return { isSupabaseMode: () => true };
      if (name === "@/lib/supabase/server") return { AuthRequestError: RequestError, preventAuthCaching: response => response, authFailure: (error, fallback, status) => NextResponse.json({ message: error instanceof RequestError ? error.message : fallback }, { status: error instanceof RequestError ? error.status : status }) };
      if (name === "@/lib/server/auth-flows") return { requireRecoverySession: async () => { throw reason; }, copyAuthCookies: (_, target) => target, clearRecoveryProof: () => { cleared = true; } };
      return require(name);
    } }));
    const response = await exports.GET(new NextRequest("https://shop.example.test/api/auth/reset-password"));
    assert.equal(response.status, expectedStatus); assert.equal(cleared, shouldClear);
  }
});
