import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export const LOGIN_POLICY_COOKIE = "ct_login_policy";
export const LOGIN_INTENT_COOKIE = "ct_login_intent";
export const COOKIE_RETENTION_SECONDS = 400 * 24 * 60 * 60;
export const IDLE_SECONDS = 30 * 24 * 60 * 60;
export type LoginPolicy = { sessionId: string; remember: boolean; expires: number };
function signature(value: string) {
  if (!process.env.APP_DATABASE_URL) throw new Error("认证服务暂不可用，请稍后重试。");
  return createHmac("sha256", process.env.APP_DATABASE_URL).update("chinatech:login:v1\0" + value).digest("base64url");
}
export function signLoginValue(value: object) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + signature(payload);
}
export function readLoginValue(value?: string): Record<string, unknown> | null {
  if (!value || value.length > 2048) return null;
  try {
    const [payload, signed, extra] = value.split(".");
    const expected = Buffer.from(signature(payload)), actual = Buffer.from(signed || "");
    if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const result = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return result && typeof result === "object" && !Array.isArray(result) ? result : null;
  } catch { return null; }
}
export function readLoginPolicy(value?: string): LoginPolicy | null {
  const policy = readLoginValue(value);
  return policy && typeof policy.sessionId === "string" && typeof policy.remember === "boolean" && typeof policy.expires === "number" && Number.isSafeInteger(policy.expires) ? policy as LoginPolicy : null;
}
export function sessionCookieOptions(name: string, options: CookieOptions, policyValue?: string): CookieOptions {
  // Never change deletion cookies or the short-lived PKCE verifier.
  if (!(name === "ct_rebuild_auth" || /^ct_rebuild_auth\.\d+$/.test(name)) || options.maxAge === 0) return options;
  const policy = readLoginPolicy(policyValue);
  const { maxAge: _age, expires: _expires, ...rest } = options;
  void _age; void _expires;
  // Cookie retention is not authorization lifetime. The database enforces the
  // rolling 30-day idle deadline; activity writes never emit Set-Cookie.
  return policy?.remember ? { ...rest, maxAge: COOKIE_RETENTION_SECONDS } : rest;
}
export function readAuthAccessToken(cookies: { name: string; value: string }[]): string | null {
  try {
    const whole = cookies.find(cookie => cookie.name === "ct_rebuild_auth")?.value;
    const encoded = whole || cookies.filter(cookie => /^ct_rebuild_auth\.\d+$/.test(cookie.name)).sort((a,b) => Number(a.name.split(".")[1])-Number(b.name.split(".")[1])).map(cookie => cookie.value).join("");
    const session = JSON.parse(encoded.startsWith("base64-") ? Buffer.from(encoded.slice(7), "base64url").toString("utf8") : encoded);
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch { return null; }
}
export function matchingLoginPolicy(cookies: { name: string; value: string }[]): string | undefined {
  const value = cookies.find(cookie => cookie.name === LOGIN_POLICY_COOKIE)?.value;
  const policy = readLoginPolicy(value), token = readAuthAccessToken(cookies);
  if (!policy || !token) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    // This is only a cookie-policy binding, never an authentication decision.
    return claims.session_id === policy.sessionId ? value : undefined;
  } catch { return undefined; }
}
export function setLoginPolicy(request: NextRequest, response: NextResponse, policy: LoginPolicy) {
  const value = signLoginValue(policy);
  request.cookies.set(LOGIN_POLICY_COOKIE, value);
  const base = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  response.cookies.set(LOGIN_POLICY_COOKIE, value, { ...base, ...(policy.remember ? { maxAge: COOKIE_RETENTION_SECONDS } : {}) });
  const cookies = new Map(request.cookies.getAll().map(cookie => [cookie.name, cookie]));
  response.cookies.getAll().forEach(cookie => cookies.set(cookie.name, cookie));
  cookies.forEach(cookie => {
    if (cookie.name === "ct_rebuild_auth" || /^ct_rebuild_auth\.\d+$/.test(cookie.name)) {
      response.cookies.set(cookie.name, cookie.value, { ...sessionCookieOptions(cookie.name, "maxAge" in cookie ? cookie as CookieOptions : {}, value), ...base });
    }
  });
}
export function clearLoginPolicy(response: NextResponse) {
  for (const name of [LOGIN_POLICY_COOKIE, LOGIN_INTENT_COOKIE]) response.cookies.set(name, "", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0 });
}
export function clearLocalAuthCookies(request: NextRequest, response: NextResponse) {
  clearLoginPolicy(response);
  const names = new Set(["ct_rebuild_auth", ...request.cookies.getAll().map(cookie => cookie.name), ...response.cookies.getAll().map(cookie => cookie.name)]);
  for (const name of names) {
    if (/^ct_rebuild_auth(?:\.\d+|-code-verifier(?:\.\d+)?)?$/.test(name)) response.cookies.set(name, "", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0 });
  }
}
export function browserDescription(agent: string) {
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /(?:Chrome|CriOS)\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "";
  const os = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Macintosh|Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return { browser, os };
}
