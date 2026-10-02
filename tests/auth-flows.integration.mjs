import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const config = JSON.parse(readFileSync(".local/backend/connection.private.json", "utf8"));
const local = (value, port) => { const url = new URL(value); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, port); return url; };
local(config.API_URL, "55421"); local(config.DB_URL, "55422");
const mail = local(config.MAILPIT_URL || config.INBUCKET_URL, "55424");
const api = "http://127.0.0.1:3117", origin = "http://localhost:3117";
const admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = postgres(config.DB_URL, { max: 1, prepare: false });
const suffix = randomBytes(6).toString("hex");
const email = `ct-recovery-${suffix}@example.test`, password = `Ct${randomBytes(20).toString("hex")}`, newPassword = `Ct${randomBytes(20).toString("hex")}`;
const checks = [];
const pass = name => { checks.push(name); console.log("PASS " + name); };
const jar = () => new Map();
async function request(cookies, path, body, options = {}) {
  const response = await fetch(api + path, { method: body === undefined ? "GET" : "POST", redirect: "manual", headers: { Origin: origin, Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(";"); const equals = pair.indexOf("="); cookies.set(pair.slice(0, equals), pair.slice(equals + 1)); }
  return response;
}
async function capturedLink(address, type) {
  let message;
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(mail.origin + "/api/v1/messages")).json();
    for (const candidate of list.messages.filter(item => item.To?.some(to => to.Address === address))) {
      const body = await (await fetch(mail.origin + "/api/v1/message/" + candidate.ID)).json();
      const urls = (body.HTML || body.Text || "").match(/https?:\/\/[^\s"<>]+/g) || [];
      const match = urls.find(url => url.includes("/auth/v1/verify?") && url.includes("type=" + type));
      if (match) { message = new URL(match.replace(/&amp;/g, "&")); break; }
    }
    if (message) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(message, "Expected mail in isolated local mail capture.");
  local(message, "55421");
  return message;
}
async function callbackFor(link) {
  const verification = await fetch(link, { redirect: "manual" });
  assert.ok([302, 303, 307].includes(verification.status));
  const callback = new URL(verification.headers.get("location"));
  assert.equal(callback.origin, origin);
  return callback.pathname + callback.search;
}
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Synthetic recovery" } });
  assert.ifError(created.error);
  const current = jar(), older = jar(), recovery = jar();
  assert.equal((await request(current, "/api/auth/login", { email, password })).status, 200);
  assert.equal((await request(older, "/api/auth/login", { email, password })).status, 200);
  assert.equal((await request(current, "/api/auth/reset-password", { password: newPassword })).status, 401);
  pass("normal password session cannot enter the password recovery endpoint");

  for (const path of ["google", "forgot-password", "resend", "reset-password"]) {
    const body = path === "google" ? {} : path === "reset-password" ? { password: newPassword } : { email };
    assert.equal((await request(jar(), `/api/auth/${path}`, body, { headers: { Origin: "https://outside.invalid" } })).status, 403);
    assert.equal((await request(jar(), `/api/auth/${path}`, { ...body, role: "owner" })).status, 400);
  }
  pass("all new auth actions reject cross-origin and unsupported privilege fields");
  assert.equal((await request(jar(), "/api/auth/google", {})).status, 503);
  pass("disabled local Google provider reports unavailable without a fake success");

  const known = await request(recovery, "/api/auth/forgot-password", { email });
  assert.equal(known.status, 200); assert.ok(known.headers.get("cache-control").includes("no-store"));
  assert.ok(known.headers.getSetCookie().every(cookie => cookie.includes("HttpOnly")));
  const unknown = await request(jar(), "/api/auth/forgot-password", { email: `ct-unknown-${suffix}@example.test` });
  assert.equal(unknown.status, 200); assert.deepEqual(await known.json(), await unknown.json());
  pass("recovery requests keep account existence private and set HttpOnly PKCE cookies");

  const callback = await callbackFor(await capturedLink(email, "recovery"));
  const wrongBrowser = await request(jar(), callback);
  assert.equal(new URL(wrongBrowser.headers.get("location")).pathname, "/login");
  const confirmed = await request(recovery, callback + "&next=https%3A%2F%2Foutside.invalid");
  assert.equal(new URL(confirmed.headers.get("location")).origin, origin);
  assert.equal(new URL(confirmed.headers.get("location")).pathname, "/reset-password");
  assert.ok(confirmed.headers.getSetCookie().some(cookie => cookie.startsWith("ct_rebuild_recovery=") && cookie.includes("HttpOnly") && cookie.includes("Max-Age=900")));
  assert.equal((await request(recovery, "/api/auth/reset-password")).status, 200);
  pass("captured recovery email completes PKCE only in initiating browser and uses fixed safe redirect");

  const tampered = new Map(recovery); tampered.set("ct_rebuild_recovery", tampered.get("ct_rebuild_recovery") + "x");
  assert.equal((await request(tampered, "/api/auth/reset-password", { password: newPassword })).status, 401);
  const swapped = new Map(current); swapped.set("ct_rebuild_recovery", recovery.get("ct_rebuild_recovery"));
  assert.equal((await request(swapped, "/api/auth/reset-password", { password: newPassword })).status, 401);
  assert.equal((await request(recovery, "/api/auth/reset-password", { password: "short" })).status, 400);
  assert.equal((await request(recovery, "/api/auth/reset-password")).status, 200);
  pass("tampered proof, other session, and weak password are rejected without consuming valid recovery");

  const oldRecovery = new Map(recovery);
  const updated = await request(recovery, "/api/auth/reset-password", { password: newPassword });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).redirectTo, "/login?notice=password-updated");
  assert.equal((await request(recovery, "/api/auth/reset-password")).status, 401);
  assert.equal((await request(oldRecovery, "/api/auth/reset-password", { password: `Ct${randomBytes(20).toString("hex")}` })).status, 401);
  assert.equal((await request(jar(), "/api/auth/login", { email, password })).status, 401);
  assert.equal((await request(jar(), "/api/auth/login", { email, password: newPassword })).status, 200);
  assert.equal((await request(older, "/api/backend/state")).status, 401);
  pass("password changes persist, old password and revoked sessions fail, and recovery proof cannot replay");
  const confirmedResend = await request(jar(), "/api/auth/resend", { email });
  const unknownResend = await request(jar(), "/api/auth/resend", { email: `ct-unknown-resend-${suffix}@example.test` });
  assert.equal(confirmedResend.status, 200); assert.equal(unknownResend.status, 200);
  assert.deepEqual(await confirmedResend.json(), await unknownResend.json());
  pass("verification resend does not reveal confirmed versus unknown accounts");
  assert.equal(new URL((await request(recovery, callback)).headers.get("location")).pathname, "/login");
  pass("recovery authorization code cannot be reused");

  const signup = jar(), signupEmail = `ct-resend-${suffix}@example.test`;
  assert.equal((await request(signup, "/api/auth/register", { email: signupEmail, password, displayName: "Synthetic resend" })).status, 200);
  // Only synthetic local capture is used; respect the configured one-second send interval.
  await new Promise(resolve => setTimeout(resolve, 1200));
  const resent = await request(signup, "/api/auth/resend", { email: signupEmail });
  assert.equal(resent.status, 200);
  const signupCallback = await callbackFor(await capturedLink(signupEmail, "signup"));
  const signupConfirmed = await request(signup, signupCallback);
  assert.equal(new URL(signupConfirmed.headers.get("location")).pathname, "/account/pending");
  assert.equal((await request(signup, "/api/backend/state")).status, 403);
  const [account] = await sql`select a.account_status,(select count(*)::int from chinatech_v2.store_memberships m where m.user_id=a.id) memberships from chinatech_v2.accounts a where a.email=${signupEmail}`;
  assert.equal(account.account_status, "active"); assert.equal(account.memberships, 0);
  pass("resend verification completes and verified signup still has no automatic store membership");
  await request(signup, "/api/auth/logout", {});
  writeFileSync(".local/backend/auth-flows-verification.json", JSON.stringify({ status: "PASS", time: new Date().toISOString(), checks, count: checks.length }, null, 2));
} finally { await sql.end(); }
