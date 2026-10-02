import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export const AUTH_COOKIE_NAME = "ct_rebuild_auth";
export function authCookieOptions(options: CookieOptions = {}): CookieOptions {
  return { ...options, path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" };
}
export function preventAuthCaching<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME, ...authCookieOptions() },
    global: { fetch: noStoreFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        // Proxy commits refresh cookies before Server Components start rendering.
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, authCookieOptions(options))); } catch { /* Read-only Server Component cookie store. */ }
      },
    },
  });
}

export function createSupabaseRouteClient(request: NextRequest, response: NextResponse) {
  const { url, publishableKey } = getSupabaseConfig();
  preventAuthCaching(response);
  return createServerClient(url, publishableKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME, ...authCookieOptions() },
    global: { fetch: noStoreFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, authCookieOptions(options));
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        preventAuthCaching(response);
      },
    },
  });
}

export class AuthRequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function trustedAuthOrigin(request: NextRequest): string {
  const configured = process.env.APP_ORIGIN;
  const expected = new URL(configured || request.url);
  if (expected.username || expected.password || !["http:", "https:"].includes(expected.protocol)) throw new AuthRequestError("认证服务暂不可用。", 503);
  return expected.origin;
}
export function requireSameOrigin(request: NextRequest): string {
  const expected = trustedAuthOrigin(request);
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new AuthRequestError("请求来源无效。", 403);
  return expected;
}
export async function readAuthBody(request: NextRequest, fields: readonly string[]): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !request.body) throw new AuthRequestError("请求格式无效。");
  if (Number(request.headers.get("content-length")) > 8192) throw new AuthRequestError("请求资料过长。", 413);
  const reader = request.body.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new AuthRequestError("请求资料过长。", 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new AuthRequestError("请求格式无效。"); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(field => !fields.includes(field))) throw new AuthRequestError("请求资料包含不支持的字段。");
  return body as Record<string, unknown>;
}
export function authEmail(value: unknown): string {
  if (typeof value !== "string" || value.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AuthRequestError("请输入有效的邮箱地址。");
  return value.trim().toLowerCase();
}
export function authPassword(value: unknown, registration = false): string {
  if (typeof value !== "string" || !value.length || value.length > 128) throw new AuthRequestError("请填写有效密码。");
  if (registration && (value.length < 10 || !/\p{L}/u.test(value) || !/\d/.test(value) || /^(password\d*!?|qwerty\d*!?|chinatech\d*!?)$/i.test(value))) throw new AuthRequestError("密码至少 10 位，包含字母和数字，并避免常见密码。");
  return value;
}
export function authFailure(reason: unknown, fallback: string, status = 503) {
  return preventAuthCaching(NextResponse.json({ message: reason instanceof AuthRequestError ? reason.message : fallback }, { status: reason instanceof AuthRequestError ? reason.status : status }));
}
