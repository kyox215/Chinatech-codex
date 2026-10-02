import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const config = JSON.parse(readFileSync(".local/backend/connection.private.json", "utf8"));
const local = (value, port) => { const url = new URL(value); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, port); return url; };
local(config.API_URL, "55421"); local(config.DB_URL, "55422"); const mail = local(config.MAILPIT_URL || config.INBUCKET_URL, "55424");
const api = "http://127.0.0.1:3117", origin = "http://localhost:3117";
const sql = postgres(config.DB_URL, { max: 1, prepare: false });
const admin = createClient(config.API_URL, config.SECRET_KEY || config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomBytes(6).toString("hex"), password = `Ct${randomBytes(20).toString("hex")}`;
const originalEmail = `ct-account-${suffix}@example.test`, changedEmail = `ct-account-new-${suffix}@example.test`;
const checks = [], jar = new Map(); let userId = "";
const pass = name => { checks.push(name); console.log("PASS " + name); };
async function request(path, body, options = {}) {
  const cookies = options.cookies ?? jar;
  const response = await fetch(api + path, { method: body === undefined ? "GET" : "POST", redirect: "manual", headers: { Origin: origin, "X-CT-Account-ID": userId, Cookie: [...cookies].map(([key, value]) => key + "=" + value).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(";"); const i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
  return response;
}
async function mailLink(email) {
  for (let i = 0; i < 30; i++) {
    const messages = (await (await fetch(mail.origin + "/api/v1/messages")).json()).messages;
    for (const message of messages.filter(message => message.To?.some(to => to.Address === email))) {
      const body = await (await fetch(mail.origin + "/api/v1/message/" + message.ID)).json();
      const urls = (body.HTML || body.Text || "").match(/https?:\/\/[^\s"<>]+/g) || [];
      const match = urls.find(url => url.includes("/auth/v1/verify?") && url.includes("type=email_change"));
      if (match) { const url = new URL(match.replace(/&amp;/g, "&")); local(url, "55421"); return url; }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Expected local email change confirmation was not captured.");
}
const overview = async () => { const response = await request("/api/auth/account"); assert.equal(response.status, 200); return await response.json(); };
try {
  const created = await admin.auth.admin.createUser({ email: originalEmail, password, email_confirm: true, user_metadata: { display_name: "Synthetic account settings" } });
  assert.ifError(created.error); userId = created.data.user.id;
  mkdirSync(".local/account-bindings", { recursive: true });
  writeFileSync(".local/account-bindings/ui-user.private.json", JSON.stringify({ email: originalEmail, password, userId }), { mode: 0o600 });
  assert.equal((await request("/api/auth/account", undefined, { cookies: new Map() })).status, 401);
  assert.equal((await request("/api/auth/login", { email: originalEmail, password })).status, 200);
  const initial = await overview(); assert.equal(initial.account.id, userId); assert.equal(initial.account.email, originalEmail); assert.equal(initial.account.pendingEmail, "");
  assert.equal((await request("/api/backend/state")).status, 403);
  assert.deepEqual(Object.keys(initial).sort(), ["account", "availability"]);
  assert.equal(JSON.stringify(initial).includes("access_token"), false);
  pass("verified account without store membership can manage only its account projection");
  const posts = [["link", { provider: "google" }], ["email", { email: changedEmail }], ["phone", { countryCode: "+39", number: "0123456789" }], ["phone/verify", { phone: "+390123456789", token: "123456" }]];
  for (const [path, body] of posts) {
    assert.equal((await request(`/api/auth/account/${path}`, body, { headers: { Origin: "https://foreign.invalid" } })).status, 403);
    assert.equal((await request(`/api/auth/account/${path}`, { ...body, userId: "another-user" })).status, 400);
    assert.equal((await request(`/api/auth/account/${path}`, body, { headers: { "X-CT-Account-ID": "previous-tab-account" } })).status, 409);
  }
  pass("all account writes reject foreign origin, arbitrary user fields, and stale-tab account IDs");
  assert.equal(initial.availability.apple, false); assert.equal(initial.availability.phone, false);
  assert.equal((await request("/api/auth/apple", {})).status, 503);
  assert.equal((await request("/api/auth/account/phone", { countryCode: "+39", number: "0123456789" })).status, 503);
  pass("disabled Apple and SMS providers report unavailable without sending external messages");
  assert.equal((await request("/api/auth/account/email", { email: changedEmail })).status, 200);
  const pending = await overview(); assert.equal(pending.account.email, originalEmail); assert.equal(pending.account.pendingEmail, changedEmail);
  pass("requesting email change leaves the verified primary email and user ID unchanged");
  const first = await mailLink(originalEmail), second = await mailLink(changedEmail);
  const intended = new URL(first.searchParams.get("redirect_to"));
  assert.equal(intended.origin, origin); assert.equal(intended.pathname, "/auth/account/callback");
  const firstResult = await fetch(first, { redirect: "manual" }); const firstTarget = new URL(firstResult.headers.get("location"));
  assert.equal(firstTarget.origin, origin); assert.equal(firstTarget.pathname, "/auth/account/callback");
  const firstCallback = await request(firstTarget.pathname + firstTarget.search);
  assert.equal(new URL(firstCallback.headers.get("location")).searchParams.get("notice"), "email-pending");
  assert.equal((await overview()).account.email, originalEmail);
  pass("first of two captured email confirmations remains pending without false success");
  const secondResult = await fetch(second, { redirect: "manual" }); const secondTarget = new URL(secondResult.headers.get("location"));
  assert.equal(secondTarget.origin, origin); assert.equal(secondTarget.pathname, "/auth/account/callback");
  assert.ok(secondTarget.searchParams.has("code"));
  const done = await request(secondTarget.pathname + secondTarget.search + "&next=https%3A%2F%2Fforeign.invalid");
  assert.equal(new URL(done.headers.get("location")).origin, origin);
  assert.equal(new URL(done.headers.get("location")).searchParams.get("notice"), "email-updated");
  const final = await overview(); assert.equal(final.account.id, userId); assert.equal(final.account.email, changedEmail); assert.equal(final.account.pendingEmail, "");
  const [mirror] = await sql`select a.id,a.email,(select count(*)::int from chinatech_v2.store_memberships m where m.user_id=a.id) memberships from chinatech_v2.accounts a where a.id=${userId}`;
  assert.equal(mirror.email, changedEmail); assert.equal(mirror.memberships, 0);
  writeFileSync(".local/account-bindings/ui-user.private.json", JSON.stringify({ email: changedEmail, password, userId }), { mode: 0o600 });
  pass("both email confirmations update the same Auth account and mirror without granting membership");
  const replay = await request(secondTarget.pathname + secondTarget.search);
  assert.equal(new URL(replay.headers.get("location")).searchParams.get("notice"), "account-failed");
  assert.equal((await request("/api/auth/login", { email: changedEmail, password }, { cookies: new Map() })).status, 200);
  pass("completed email callback cannot replay and new primary email can log in");
  writeFileSync(".local/account-bindings/integration-verification.json", JSON.stringify({ status: "PASS", time: new Date().toISOString(), count: checks.length, checks }, null, 2));
} finally { await sql.end(); }
